function classificarModeloCobranca(textoLegislacao) {
  const texto = String(textoLegislacao || "").toLowerCase();

  const temFaixa = /faixa|escalonad|intervalo/.test(texto) && /kwh|consumo/.test(texto);
  const temPercentual = /%|percentual/.test(texto) && /consumo|fatura|energia/.test(texto);
  const temFixo = /valor fixo|valor mensal|valor unitario|valor unico|valor por unidade/.test(texto);

  const quantidade = [temFaixa, temPercentual, temFixo].filter(Boolean).length;
  if (quantidade > 1) {
    return "mista";
  }
  if (temFaixa) {
    return "faixa_consumo";
  }
  if (temPercentual) {
    return "percentual_consumo";
  }
  if (temFixo) {
    return "valor_fixo";
  }
  return "mista";
}

function extrairNumeroLei(textoLegislacao) {
  const texto = String(textoLegislacao || "");
  const match = texto.match(/lei\s*(?:municipal)?\s*(?:n(?:[.\u00ba\u00b0o]|u?mero)?\s*)?([\d./-]+)/i);
  return match ? String(match[1]).trim() : "";
}

function normalizarValorMonetario(valorTexto) {
  const texto = String(valorTexto || "")
    .replace(/[R$\s]/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const valor = Number(texto);
  return Number.isFinite(valor) ? Number(valor.toFixed(4)) : null;
}

function extrairFaixasConsumo(textoLegislacao) {
  const texto = String(textoLegislacao || "");
  const regex = /(\d+)\s*(?:a|ate|at\u00e9|-)\s*(\d+)\s*kwh[^R$]*R\$\s*([\d.,]+)/gi;
  const faixas = [];
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const minimo = Number(match[1]);
    const maximo = Number(match[2]);
    const valor = normalizarValorMonetario(match[3]);

    if (!Number.isFinite(minimo) || !Number.isFinite(maximo) || valor === null) {
      continue;
    }

    faixas.push({
      faixa_kwh_min: minimo,
      faixa_kwh_max: maximo,
      valor
    });
  }

  return faixas;
}

function extrairValorFixo(textoLegislacao) {
  const texto = String(textoLegislacao || "");
  const regex = /(?:valor fixo|valor mensal|contribui(?:c|ç)(?:a|ã)o)\D{0,40}R\$\s*([\d.,]+)/i;
  const match = texto.match(regex);
  if (!match) {
    return null;
  }

  return normalizarValorMonetario(match[1]);
}

function extrairPercentual(textoLegislacao) {
  const texto = String(textoLegislacao || "");
  const regex = /(\d+(?:[.,]\d+)?)\s*%\s*(?:do|sobre)\s*(?:consumo|valor)/i;
  const match = texto.match(regex);
  if (!match) {
    return null;
  }

  const percentual = Number(String(match[1]).replace(",", "."));
  if (!Number.isFinite(percentual)) {
    return null;
  }

  return Number((percentual / 100).toFixed(6));
}

function extrairObservacoes(textoLegislacao) {
  const texto = String(textoLegislacao || "").replace(/\s+/g, " ");
  const frases = texto.split(/[.;]/).map((item) => item.trim());
  const observacoes = frases.filter((frase) => /isen(?:c|ç)(?:a|ã)o|baixa renda|imune|isento/i.test(frase));
  return observacoes.join("; ");
}

function inferirConfianca({ leiNumero, fonte, valores, modeloCobranca }) {
  const fonteOficial = /\.gov\.br|prefeitura|camara|c[aâ]mara/i.test(String(fonte || ""));
  const temLei = Boolean(leiNumero);
  const temValores = Array.isArray(valores) && valores.length > 0;
  const modeloEstruturado = modeloCobranca !== "mista" || temValores;

  if (fonteOficial && temLei && temValores && modeloEstruturado) {
    return "alta";
  }

  if ((fonteOficial && temLei) || (temLei && temValores)) {
    return "media";
  }

  return "baixa";
}

function parseLegislacaoCip({ municipio, uf, codigoMunicipioIBGE, textoLegislacao, fonte }) {
  const texto = String(textoLegislacao || "");
  const modeloCobranca = classificarModeloCobranca(texto);
  const leiNumero = extrairNumeroLei(texto);
  const faixas = extrairFaixasConsumo(texto);
  const valorFixo = extrairValorFixo(texto);
  const percentual = extrairPercentual(texto);
  const fonteTexto = String(fonte || "").trim();
  const fonteOficial = /\.gov\.br|prefeitura|camara|c[aâ]mara/i.test(fonteTexto);

  let valores = [];
  if (faixas.length > 0) {
    valores = faixas;
  } else if (valorFixo !== null) {
    valores = [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: valorFixo }];
  } else if (percentual !== null) {
    valores = [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: percentual }];
  }

  const confianca = inferirConfianca({
    leiNumero,
    fonte: fonteTexto,
    valores,
    modeloCobranca
  });

  return {
    municipio: String(municipio || "").trim(),
    uf: String(uf || "").trim().toUpperCase(),
    codigoMunicipioIBGE: String(codigoMunicipioIBGE || "").trim(),
    lei: {
      numero: leiNumero,
      descricao: "Legislacao de CIP/COSIP identificada automaticamente",
      fonte: fonteTexto
    },
    modeloCobranca,
    valores,
    observacoes: extrairObservacoes(texto),
    fonte_oficial: fonteOficial,
    ultima_atualizacao: new Date().toISOString(),
    confianca,
    status: "oficial"
  };
}

module.exports = {
  classificarModeloCobranca,
  parseLegislacaoCip,
  __internals: {
    extrairNumeroLei,
    extrairFaixasConsumo,
    extrairValorFixo,
    extrairPercentual,
    extrairObservacoes
  }
};
