const billingConfigData = require("../data/billingConfigData");
const bandeiraData = require("../data/bandeiraData");
const impostosData = require("../data/impostosData");
const tarifasService = require("./tarifasService");
const { toNumber, isValidNumber } = require("../utils/number");

const TIPOS_VALIDOS = new Set(["fornecimento", "tributo", "regulatorio"]);
const ESCOPOS_VALIDOS = new Set(["nacional", "estadual", "municipal"]);
const MODELOS_VALIDOS = new Set(["fixo", "percentual", "calculado"]);
const CONFIANCAS_VALIDAS = new Set(["alta", "media", "baixa"]);
const CODIGOS_PERMITIDOS = new Set([
  "te",
  "tusd",
  "pis",
  "cofins",
  "icms",
  "bandeira",
  "correcao_monetaria",
  "icms_cde",
  "ipca_nf"
]);

function arredondar(valor) {
  return Number(valor.toFixed(2));
}

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarCidade(cidade) {
  return removerAcentos(cidade).trim().toUpperCase().replace(/\s+/g, " ");
}

function normalizarUf(uf) {
  return removerAcentos(uf).trim().toUpperCase();
}

function normalizarBandeira(tipoBandeira) {
  return String(tipoBandeira || "").trim().toLowerCase();
}

function normalizarConfianca(confianca) {
  const normalizada = String(confianca || "").trim().toLowerCase();
  return CONFIANCAS_VALIDAS.has(normalizada) ? normalizada : "baixa";
}

function percentualEhValido(valor) {
  const numero = toNumber(valor);
  return isValidNumber(numero) && numero >= 0 && numero <= 1;
}

function valorNaoNegativo(valor) {
  const numero = toNumber(valor);
  return isValidNumber(numero) && numero >= 0;
}

function normalizarDataReferencia(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  if (typeof valor === "number" && Number.isFinite(valor)) {
    return new Date(valor).toISOString();
  }

  const texto = String(valor || "").trim();
  if (!texto) {
    return null;
  }

  const timestamp = Date.parse(texto);
  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return texto;
}

function criarItem({
  codigo,
  tipo,
  escopo,
  origem = escopo,
  modelo,
  valor,
  baseCalculo = null,
  aliquota = null,
  valorUnitario = null,
  fonte = null,
  fonteUrl = null,
  confianca = "baixa",
  dataReferencia = null,
  ultimaAtualizacao = null
}) {
  if (!CODIGOS_PERMITIDOS.has(codigo)) {
    return null;
  }

  if (!TIPOS_VALIDOS.has(tipo) || !ESCOPOS_VALIDOS.has(escopo) || !MODELOS_VALIDOS.has(modelo)) {
    return null;
  }

  if (!ESCOPOS_VALIDOS.has(origem)) {
    return null;
  }

  const valorNumerico = toNumber(valor);
  if (!isValidNumber(valorNumerico) || valorNumerico < 0) {
    return null;
  }

  const aliquotaNumerica =
    aliquota === null || aliquota === undefined ? null : toNumber(aliquota);
  const valorUnitarioNumerico =
    valorUnitario === null || valorUnitario === undefined ? null : toNumber(valorUnitario);
  if (modelo === "percentual" && !percentualEhValido(aliquotaNumerica)) {
    return null;
  }

  if (aliquotaNumerica !== null && !percentualEhValido(aliquotaNumerica)) {
    return null;
  }

  if (valorUnitarioNumerico !== null && (!isValidNumber(valorUnitarioNumerico) || valorUnitarioNumerico < 0)) {
    return null;
  }

  const dataRef = normalizarDataReferencia(dataReferencia || ultimaAtualizacao);

  return {
    codigo,
    tipo,
    escopo,
    origem,
    modelo,
    valor: arredondar(valorNumerico),
    baseCalculo,
    aliquota: isValidNumber(aliquotaNumerica) ? aliquotaNumerica : null,
    valorUnitario: isValidNumber(valorUnitarioNumerico) ? valorUnitarioNumerico : null,
    fonte: fonte || null,
    fonteUrl: fonteUrl || null,
    confianca: normalizarConfianca(confianca),
    dataReferencia: dataRef,
    ultimaAtualizacao: dataRef
  };
}

function normalizarRegraIcms(regra, ufPadrao = "DEFAULT") {
  if (!regra || typeof regra !== "object") {
    return null;
  }

  const uf = normalizarUf(regra.uf || ufPadrao || "DEFAULT") || "DEFAULT";
  const tipo = String(regra.tipo || "percentual").trim().toLowerCase();
  const valor = toNumber(
    regra.valor === null || regra.valor === undefined ? regra.aliquota : regra.valor
  );
  const faixaConsumo = regra.faixaConsumo && typeof regra.faixaConsumo === "object"
    ? regra.faixaConsumo
    : {};
  const faixaMin = toNumber(
    faixaConsumo.min === null || faixaConsumo.min === undefined ? regra.faixaKwhMin : faixaConsumo.min
  );
  const faixaMaxRaw =
    faixaConsumo.max === undefined ? regra.faixaKwhMax : faixaConsumo.max;
  const faixaMax = faixaMaxRaw === null || faixaMaxRaw === undefined ? null : toNumber(faixaMaxRaw);

  if (tipo !== "percentual" || !percentualEhValido(valor)) {
    return null;
  }

  if (!isValidNumber(faixaMin) || faixaMin < 0) {
    return null;
  }

  if (faixaMax !== null && (!isValidNumber(faixaMax) || faixaMax < 0 || faixaMin > faixaMax)) {
    return null;
  }

  return {
    uf,
    tipo,
    valor,
    faixaConsumo: {
      min: faixaMin,
      max: faixaMax
    },
    fonte: String(regra.fonte || "nao_oficial").trim() || "nao_oficial",
    fonteUrl: String(regra.fonteUrl || "").trim() || null,
    confianca: normalizarConfianca(regra.confianca || "baixa"),
    dataReferencia: normalizarDataReferencia(regra.dataReferencia || regra.ultimaAtualizacao),
    observacao: String(regra.observacao || "").trim() || null
  };
}

function obterRegrasIcms(configuracao) {
  const regrasDiretas = Array.isArray(configuracao && configuracao.icmsRegras)
    ? configuracao.icmsRegras
    : [];
  if (regrasDiretas.length > 0) {
    return regrasDiretas
      .map((regra) => normalizarRegraIcms(regra, regra && regra.uf))
      .filter(Boolean);
  }

  const icmsPorUf = (configuracao && configuracao.icmsPorUf) || {};
  const regras = [];

  Object.keys(icmsPorUf).forEach((uf) => {
    const lista = Array.isArray(icmsPorUf[uf]) ? icmsPorUf[uf] : [];
    lista.forEach((regra) => {
      const normalizada = normalizarRegraIcms(regra, uf);
      if (normalizada) {
        regras.push(normalizada);
      }
    });
  });

  return regras;
}

function regraAtendeConsumo(regra, consumoKwh) {
  const minimo = toNumber(regra && regra.faixaConsumo && regra.faixaConsumo.min);
  const maximo =
    regra && regra.faixaConsumo && regra.faixaConsumo.max !== null
      ? toNumber(regra.faixaConsumo.max)
      : null;

  if (!isValidNumber(minimo) || consumoKwh < minimo) {
    return false;
  }

  if (maximo !== null && (!isValidNumber(maximo) || consumoKwh > maximo)) {
    return false;
  }

  return true;
}

function obterRegraIcms(configuracao, uf, consumoKwh) {
  const regras = obterRegrasIcms(configuracao);
  const ufNormalizada = normalizarUf(uf) || "DEFAULT";
  const regrasUf = regras.filter((item) => item.uf === ufNormalizada);
  const regrasDefault = regras.filter((item) => item.uf === "DEFAULT");
  const regraFaixa =
    regrasUf.find((item) => regraAtendeConsumo(item, consumoKwh)) ||
    regrasDefault.find((item) => regraAtendeConsumo(item, consumoKwh)) ||
    regrasUf[0] ||
    regrasDefault[0];

  if (regraFaixa) {
    return regraFaixa;
  }

  return {
    uf: ufNormalizada,
    tipo: "percentual",
    valor: 0.25,
    faixaConsumo: {
      min: 0,
      max: null
    },
    fonte: "nao_oficial",
    fonteUrl: null,
    confianca: "baixa",
    dataReferencia: null,
    observacao: "Regra fallback local."
  };
}

function obterBandeira(tipoInformado) {
  const bandeiraAtual = bandeiraData.getBandeiraAtual();
  const valoresKwh = bandeiraAtual.valoresKwh || {};
  const tipoNormalizado = normalizarBandeira(tipoInformado);
  const tipoSelecionado = tipoNormalizado || bandeiraAtual.vigente;
  const valorKwh = toNumber(valoresKwh[tipoSelecionado]);

  if (!tipoSelecionado || !isValidNumber(valorKwh)) {
    return {
      tipo: "verde",
      valorKwh: 0,
      fonte: "fallback_local",
      confianca: "baixa",
      dataReferencia: null
    };
  }

  return {
    tipo: tipoSelecionado,
    valorKwh,
    fonte: "api_bandeira",
    confianca: "media",
    dataReferencia: null
  };
}

function obterTarifaDetalhada(distribuidora) {
  const tarifaVigente = tarifasService.obterTarifaVigentePorDistribuidora(distribuidora.codigo);
  const tarifaTotalFallback = toNumber(
    distribuidora.tarifa || distribuidora.tarifaBaseKwh || distribuidora.tarifaKwh || 0.82
  );
  const tarifaTotalVigente = tarifaVigente && toNumber(tarifaVigente.tarifaKwh);
  const tarifaTotal = isValidNumber(tarifaTotalVigente)
    ? tarifaTotalVigente
    : isValidNumber(tarifaTotalFallback)
      ? tarifaTotalFallback
      : 0.82;

  const teKwhVigente =
    tarifaVigente && tarifaVigente.teKwh !== null && tarifaVigente.teKwh !== undefined
      ? toNumber(tarifaVigente.teKwh)
      : Number.NaN;
  const tusdKwhVigente =
    tarifaVigente && tarifaVigente.tusdKwh !== null && tarifaVigente.tusdKwh !== undefined
      ? toNumber(tarifaVigente.tusdKwh)
      : Number.NaN;
  const teKwh =
    isValidNumber(teKwhVigente) && teKwhVigente >= 0 ? teKwhVigente : tarifaTotal;
  const tusdKwh =
    isValidNumber(tusdKwhVigente) && tusdKwhVigente >= 0 ? tusdKwhVigente : Math.max(tarifaTotal - teKwh, 0);

  return {
    tarifaTotalKwh: tarifaTotal,
    teKwh,
    tusdKwh,
    fonte: (tarifaVigente && tarifaVigente.fonte) || "fallback_local",
    confianca:
      tarifaVigente && tarifaVigente.fonte === "aneel"
        ? "media"
        : "baixa",
    dataReferencia: normalizarDataReferencia(
      tarifaVigente && tarifaVigente.dataInicioVigencia
        ? tarifaVigente.dataInicioVigencia
        : null
    )
  };
}

function resolverBaseCalculo(baseCalculo, contexto) {
  if (baseCalculo === "subtotal_energia") {
    return contexto.subtotalEnergia;
  }

  if (baseCalculo === "subtotal_tributavel") {
    return contexto.subtotalTributavel;
  }

  if (baseCalculo === "consumo_total") {
    return contexto.consumoKwh;
  }

  return contexto.subtotalEnergia;
}

function calcularItensRegulatorios(configuracao, contextoBase) {
  const regras = Array.isArray(configuracao.regulatorios) ? configuracao.regulatorios : [];
  const itens = [];

  regras.forEach((regra) => {
    if (!regra || regra.ativo !== true) {
      return;
    }

    const modelo = String(regra.modelo || "").trim().toLowerCase();
    const baseCalculo = regra.baseCalculo || "subtotal_energia";
    const valorRegra = toNumber(regra.valor);
    const base = resolverBaseCalculo(baseCalculo, contextoBase);
    let valorCalculado = 0;

    if (modelo === "percentual") {
      if (!percentualEhValido(valorRegra)) {
        return;
      }

      valorCalculado = base * (isValidNumber(valorRegra) ? valorRegra : 0);
    } else if (modelo === "fixo") {
      if (!valorNaoNegativo(valorRegra)) {
        return;
      }

      valorCalculado = isValidNumber(valorRegra) ? valorRegra : 0;
    } else if (modelo === "calculado") {
      if (!valorNaoNegativo(valorRegra)) {
        return;
      }

      valorCalculado = isValidNumber(valorRegra) ? valorRegra : 0;
    } else {
      return;
    }

    const item = criarItem({
      codigo: regra.codigo,
      tipo: "regulatorio",
      escopo: regra.escopo || "nacional",
      origem: regra.escopo || "nacional",
      modelo,
      valor: valorCalculado,
      baseCalculo,
      aliquota: modelo === "percentual" ? valorRegra : null,
      fonte: regra.fonte || (regra.fonteUrl ? "referencia_externa" : "config_local"),
      fonteUrl: regra.fonteUrl || null,
      confianca: regra.confianca || "baixa",
      dataReferencia: regra.dataReferencia || regra.ultimaAtualizacao || null
    });

    if (item) {
      itens.push(item);
    }
  });

  return itens;
}

function calcularImpostosMunicipais(configuracao, cidade, uf, subtotalTributavel) {
  const impostosMunicipais = Array.isArray(configuracao.impostosMunicipais)
    ? configuracao.impostosMunicipais
    : [];
  const cidadeNormalizada = normalizarCidade(cidade);
  const ufNormalizada = normalizarUf(uf);
  const itens = [];

  impostosMunicipais.forEach((regra) => {
    if (!regra || regra.fonteOficial !== true) {
      return;
    }

    const codigo = String(regra.codigo || "").trim().toLowerCase();
    if (!codigo || codigo === "cip") {
      return;
    }

    const ufRegra = normalizarUf(regra.uf);
    const cidadeRegra = normalizarCidade(regra.cidade);
    if (!ufRegra || !cidadeRegra || ufRegra !== ufNormalizada || cidadeRegra !== cidadeNormalizada) {
      return;
    }

    const modelo = String(regra.modelo || "").trim().toLowerCase();
    const valorRegra = toNumber(regra.valor);
    let valorItem = 0;

    if (modelo === "percentual") {
      if (!percentualEhValido(valorRegra)) {
        return;
      }

      valorItem = subtotalTributavel * (isValidNumber(valorRegra) ? valorRegra : 0);
    } else if (modelo === "fixo") {
      if (!valorNaoNegativo(valorRegra)) {
        return;
      }

      valorItem = isValidNumber(valorRegra) ? valorRegra : 0;
    } else {
      return;
    }

    const item = criarItem({
      codigo,
      tipo: "tributo",
      escopo: "municipal",
      origem: "municipal",
      modelo,
      valor: valorItem,
      baseCalculo: modelo === "percentual" ? "subtotal_tributavel" : "valor_fatura",
      aliquota: modelo === "percentual" ? valorRegra : null,
      fonte: regra.fonte || (regra.fonteUrl ? "referencia_externa" : "config_local"),
      fonteUrl: regra.fonteUrl || null,
      confianca: regra.confianca || "media",
      dataReferencia: regra.dataReferencia || regra.ultimaAtualizacao || null
    });

    if (item) {
      itens.push(item);
    }
  });

  return itens;
}

function somarItens(itens) {
  return arredondar(
    itens.reduce((acumulador, item) => {
      return acumulador + toNumber(item.valor || 0);
    }, 0)
  );
}

function calcularFatura(
  { leituraAnterior, leituraAtual, diasDecorridos, cidade, uf, distribuidora, bandeira },
  opcoes = {}
) {
  const configuracao = opcoes.configuracao || billingConfigData.getBillingConfig() || {};
  const impostos = opcoes.impostos || impostosData.getImpostos() || {};
  const consumoKwh = toNumber(leituraAtual) - toNumber(leituraAnterior);
  const dias = toNumber(diasDecorridos);
  const mediaDiaria = arredondar(consumoKwh / dias);
  const ufCalculo = normalizarUf(uf || (distribuidora && distribuidora.uf) || "");
  const cidadeCalculo = String(cidade || "").trim();
  const tarifaDetalhada = obterTarifaDetalhada(distribuidora);
  const bandeiraSelecionada = obterBandeira(bandeira);

  const itemTe = criarItem({
    codigo: "te",
    tipo: "fornecimento",
    escopo: "nacional",
    origem: "nacional",
    modelo: "calculado",
    valor: consumoKwh * tarifaDetalhada.teKwh,
    baseCalculo: "consumo_total",
    valorUnitario: tarifaDetalhada.teKwh,
    fonte: tarifaDetalhada.fonte,
    confianca: tarifaDetalhada.confianca,
    dataReferencia: tarifaDetalhada.dataReferencia
  });

  const itemTusd = criarItem({
    codigo: "tusd",
    tipo: "fornecimento",
    escopo: "nacional",
    origem: "nacional",
    modelo: "calculado",
    valor: consumoKwh * tarifaDetalhada.tusdKwh,
    baseCalculo: "consumo_total",
    valorUnitario: tarifaDetalhada.tusdKwh,
    fonte: tarifaDetalhada.fonte,
    confianca: tarifaDetalhada.confianca,
    dataReferencia: tarifaDetalhada.dataReferencia
  });

  const itemBandeira = criarItem({
    codigo: "bandeira",
    tipo: "regulatorio",
    escopo: "nacional",
    origem: "nacional",
    modelo: "calculado",
    valor: consumoKwh * bandeiraSelecionada.valorKwh,
    baseCalculo: "consumo_total",
    valorUnitario: bandeiraSelecionada.valorKwh,
    fonte: bandeiraSelecionada.fonte,
    confianca: bandeiraSelecionada.confianca,
    dataReferencia: bandeiraSelecionada.dataReferencia
  });

  const subtotalEnergia = somarItens([itemTe, itemTusd, itemBandeira].filter(Boolean));
  const itensRegulatorios = calcularItensRegulatorios(configuracao, {
    consumoKwh,
    subtotalEnergia,
    subtotalTributavel: subtotalEnergia
  });
  const subtotalRegulatorioExtra = somarItens(itensRegulatorios);
  const subtotalTributavel = arredondar(subtotalEnergia + subtotalRegulatorioExtra);

  const pisAliquota = toNumber(impostos.pis);
  const cofinsAliquota = toNumber(impostos.cofins);
  const regraIcms = obterRegraIcms(configuracao, ufCalculo, consumoKwh);
  const icmsAliquota = toNumber(regraIcms.valor);

  const itemPis = criarItem({
    codigo: "pis",
    tipo: "tributo",
    escopo: "nacional",
    origem: "nacional",
    modelo: "percentual",
    valor: subtotalTributavel * (isValidNumber(pisAliquota) ? pisAliquota : 0),
    baseCalculo: "subtotal_tributavel",
    aliquota: isValidNumber(pisAliquota) ? pisAliquota : 0,
    fonte: "config_local_impostos",
    confianca: "media",
    dataReferencia: null
  });

  const itemCofins = criarItem({
    codigo: "cofins",
    tipo: "tributo",
    escopo: "nacional",
    origem: "nacional",
    modelo: "percentual",
    valor: subtotalTributavel * (isValidNumber(cofinsAliquota) ? cofinsAliquota : 0),
    baseCalculo: "subtotal_tributavel",
    aliquota: isValidNumber(cofinsAliquota) ? cofinsAliquota : 0,
    fonte: "config_local_impostos",
    confianca: "media",
    dataReferencia: null
  });

  const itemIcms = criarItem({
    codigo: "icms",
    tipo: "tributo",
    escopo: "estadual",
    origem: "estadual",
    modelo: "percentual",
    valor: subtotalTributavel * (isValidNumber(icmsAliquota) ? icmsAliquota : 0),
    baseCalculo: "subtotal_tributavel",
    aliquota: isValidNumber(icmsAliquota) ? icmsAliquota : 0,
    fonte: regraIcms.fonte || "nao_oficial",
    fonteUrl: regraIcms.fonteUrl || null,
    confianca: regraIcms.confianca || "baixa",
    dataReferencia: regraIcms.dataReferencia || null
  });

  const itensMunicipais = calcularImpostosMunicipais(
    configuracao,
    cidadeCalculo,
    ufCalculo,
    subtotalTributavel
  );

  const itens = [
    itemTe,
    itemTusd,
    itemBandeira,
    ...itensRegulatorios,
    itemPis,
    itemCofins,
    itemIcms,
    ...itensMunicipais
  ].filter(Boolean);

  const total = somarItens(itens);

  return {
    cidade: cidadeCalculo || null,
    uf: ufCalculo || (distribuidora && distribuidora.uf) || null,
    statusSimulacao: "simulado",
    distribuidora: distribuidora.nome,
    consumoKwh,
    mediaDiaria,
    diasDecorridos: dias,
    valorEnergia: somarItens([itemTe, itemTusd].filter(Boolean)),
    bandeira: {
      tipo: bandeiraSelecionada.tipo,
      valor: itemBandeira ? itemBandeira.valor : 0
    },
    icms: itemIcms ? itemIcms.valor : 0,
    cip: null,
    cipCalculadaSeparadamente: true,
    itens,
    total,
    aviso: configuracao.avisoPadrao
  };
}

module.exports = {
  calcularFatura,
  __internals: {
    criarItem,
    obterRegraIcms,
    normalizarCidade,
    normalizarUf,
    resolverBaseCalculo
  }
};
