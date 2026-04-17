const cipData = require("../data/cipData");
const municipiosIbgeData = require("../data/municipiosIbgeData");
const cipCollector = require("./cipCollector");
const cipParser = require("./cipParser");

const ORDEM_CONFIANCA = {
  baixa: 1,
  media: 2,
  alta: 3
};

function normalizarCidade(cidade) {
  return String(cidade || "").trim();
}

function normalizarUf(uf) {
  return String(uf || "")
    .trim()
    .toUpperCase();
}

function permitirEstimativaFallback() {
  return process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK !== "false";
}

function valorEstimadoPadrao() {
  const configurado = Number(process.env.CIP_VALOR_ESTIMADO_PADRAO);
  if (Number.isFinite(configurado) && configurado >= 0) {
    return Number(configurado.toFixed(2));
  }

  return 12.5;
}

function calcularValorEstimadoCip() {
  const base = cipData.getCipCache();
  const valores = [];

  base.forEach((registro) => {
    if (registro.status !== "oficial") {
      return;
    }

    if (registro.modeloCobranca === "percentual_consumo") {
      return;
    }

    (Array.isArray(registro.valores) ? registro.valores : []).forEach((item) => {
      const valor = Number(item && item.valor);
      if (Number.isFinite(valor) && valor > 0) {
        valores.push(valor);
      }
    });
  });

  if (valores.length === 0) {
    return valorEstimadoPadrao();
  }

  const media = valores.reduce((total, atual) => total + atual, 0) / valores.length;
  return Number(media.toFixed(2));
}

function criarLeiPadrao(lei) {
  const numero =
    lei && typeof lei === "object" && String(lei.numero || "").trim()
      ? String(lei.numero || "").trim()
      : null;
  const descricao =
    lei && typeof lei === "object" && String(lei.descricao || "").trim()
      ? String(lei.descricao || "").trim()
      : null;

  return { numero, descricao };
}

function criarCipPadrao(payload = {}) {
  const valores = Array.isArray(payload.valores)
    ? payload.valores.map((item) => ({ ...item }))
    : [];

  return {
    modeloCobranca: payload.modeloCobranca || null,
    valores,
    lei: criarLeiPadrao(payload.lei),
    fonteUrl: payload.fonteUrl || null,
    confianca: payload.confianca || null,
    ultimaAtualizacao: payload.ultimaAtualizacao || null
  };
}

function criarRespostaPadrao({
  status,
  cidade,
  uf,
  codigoMunicipioIBGE,
  mensagem = null,
  cip
}) {
  return {
    status,
    mensagem,
    municipio: cidade || null,
    uf: uf || null,
    codigoMunicipioIBGE: codigoMunicipioIBGE || "",
    cip: criarCipPadrao(cip)
  };
}

function montarRespostaOficial(registro, codigoMunicipioIBGE) {
  const fonteUrl = registro.lei && registro.lei.fonte
    ? String(registro.lei.fonte).trim()
    : registro.fonteUrl
      ? String(registro.fonteUrl).trim()
      : null;
  return criarRespostaPadrao({
    status: "oficial",
    cidade: registro.municipio,
    uf: registro.uf,
    codigoMunicipioIBGE: registro.codigoMunicipioIBGE || codigoMunicipioIBGE || "",
    cip: {
      modeloCobranca: registro.modeloCobranca || null,
      valores: registro.valores || [],
      lei: registro.lei || null,
      fonteUrl,
      confianca: registro.confianca || "media",
      ultimaAtualizacao: registro.ultima_atualizacao || null
    }
  });
}

function montarRespostaEstimado({ cidade, uf, codigoMunicipioIBGE, valor }) {
  const valorEstimado = Number.isFinite(valor) ? Number(valor.toFixed(2)) : valorEstimadoPadrao();
  return criarRespostaPadrao({
    status: "estimado",
    mensagem:
      "CIP estimada para este municipio: a legislacao municipal nao foi encontrada ou nao consta na base oficial.",
    cidade,
    uf,
    codigoMunicipioIBGE: codigoMunicipioIBGE || "",
    cip: {
      modeloCobranca: "valor_fixo",
      valores: [
        {
          faixa_kwh_min: 0,
          faixa_kwh_max: null,
          valor: valorEstimado
        }
      ],
      lei: null,
      fonteUrl: null,
      confianca: "baixa",
      ultimaAtualizacao: new Date().toISOString()
    }
  });
}

function montarRespostaNaoEncontrado({ cidade, uf, codigoMunicipioIBGE }) {
  return criarRespostaPadrao({
    status: "nao_encontrado",
    mensagem: "CIP nao cadastrada para este municipio.",
    cidade,
    uf,
    codigoMunicipioIBGE: codigoMunicipioIBGE || "",
    cip: {
      modeloCobranca: null,
      valores: [],
      lei: null,
      fonteUrl: null,
      confianca: null,
      ultimaAtualizacao: null
    }
  });
}

function getCipPorCidade(cidade, uf) {
  const cidadeNormalizada = normalizarCidade(cidade);
  const ufNormalizada = normalizarUf(uf);
  const codigoMunicipioIBGE = municipiosIbgeData.resolverCodigoMunicipioIbge(
    cidadeNormalizada,
    ufNormalizada
  );

  const registro = cipData.encontrarCipPorCidadeUf(cidadeNormalizada, ufNormalizada);
  if (registro && registro.status === "oficial") {
    return montarRespostaOficial(registro, codigoMunicipioIBGE);
  }

  if (registro && registro.status === "estimado") {
    const valorEstimadoRegistro = Number(
      registro.valores &&
        registro.valores[0] &&
        Number.isFinite(Number(registro.valores[0].valor))
        ? registro.valores[0].valor
        : Number.NaN
    );
    return montarRespostaEstimado({
      cidade: cidadeNormalizada,
      uf: ufNormalizada,
      codigoMunicipioIBGE,
      valor: valorEstimadoRegistro
    });
  }

  if (!permitirEstimativaFallback()) {
    return montarRespostaNaoEncontrado({
      cidade: cidadeNormalizada,
      uf: ufNormalizada,
      codigoMunicipioIBGE
    });
  }

  const valorEstimado = calcularValorEstimadoCip();
  if (!Number.isFinite(valorEstimado)) {
    return montarRespostaNaoEncontrado({
      cidade: cidadeNormalizada,
      uf: ufNormalizada,
      codigoMunicipioIBGE
    });
  }

  return montarRespostaEstimado({
    cidade: cidadeNormalizada,
    uf: ufNormalizada,
    codigoMunicipioIBGE,
    valor: valorEstimado
  });
}

function escolherMelhorRegistro(registros) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return null;
  }

  const candidatos = registros.filter((item) => {
    return item && item.status === "oficial" && Array.isArray(item.valores) && item.valores.length > 0;
  });

  if (candidatos.length === 0) {
    return null;
  }

  return candidatos.sort((a, b) => {
    const scoreA = ORDEM_CONFIANCA[a.confianca] || 0;
    const scoreB = ORDEM_CONFIANCA[b.confianca] || 0;

    if (scoreA !== scoreB) {
      return scoreB - scoreA;
    }

    const dataA = Date.parse(a.ultima_atualizacao || "");
    const dataB = Date.parse(b.ultima_atualizacao || "");
    return (Number.isFinite(dataB) ? dataB : 0) - (Number.isFinite(dataA) ? dataA : 0);
  })[0];
}

async function coletarESalvarCipMunicipio({ cidade, uf, codigoMunicipioIBGE = "", fetchImpl = fetch }) {
  const cidadeNormalizada = normalizarCidade(cidade);
  const ufNormalizada = normalizarUf(uf);
  const codigoResolvido =
    String(codigoMunicipioIBGE || "").trim() ||
    municipiosIbgeData.resolverCodigoMunicipioIbge(cidadeNormalizada, ufNormalizada);

  const fontes = await cipCollector.coletarFontesCip({
    cidade: cidadeNormalizada,
    uf: ufNormalizada,
    fetchImpl
  });

  const registros = fontes.map((item) => {
    return cipParser.parseLegislacaoCip({
      municipio: cidadeNormalizada,
      uf: ufNormalizada,
      codigoMunicipioIBGE: codigoResolvido,
      textoLegislacao: item.textoLegislacao,
      fonte: item.fonte
    });
  });

  const melhorRegistro = escolherMelhorRegistro(registros);
  if (!melhorRegistro) {
    cipData.registrarProgressoColeta({
      municipio: cidadeNormalizada,
      uf: ufNormalizada,
      status: "sem_dados",
      fonte: "coleta_web",
      mensagem: "Nenhum registro oficial de CIP foi identificado."
    });

    return getCipPorCidade(cidadeNormalizada, ufNormalizada);
  }

  cipData.upsertRegistrosCip([melhorRegistro]);
  cipData.registrarProgressoColeta({
    municipio: cidadeNormalizada,
    uf: ufNormalizada,
    status: "atualizado",
    fonte: melhorRegistro.lei && melhorRegistro.lei.fonte ? melhorRegistro.lei.fonte : "",
    mensagem: "Registro oficial de CIP atualizado."
  });

  return getCipPorCidade(cidadeNormalizada, ufNormalizada);
}

module.exports = {
  getCipPorCidade,
  coletarESalvarCipMunicipio,
  __internals: {
    calcularValorEstimadoCip,
    escolherMelhorRegistro,
    permitirEstimativaFallback
  }
};
