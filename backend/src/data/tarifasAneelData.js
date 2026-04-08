const { readJson } = require("../utils/readJson");
const {
  normalizarChave,
  resolverSigAgentePorNomeDistribuidora
} = require("./distribuidoraAneelMap");

const FALLBACK_TARIFAS = readJson("data/tarifas.json");
const URL_TARIFAS_ANEEL =
  "https://dadosabertos.aneel.gov.br/dataset/5a583f3e-1646-4f67-bf0f-69db4203e89e/resource/fcf2906c-7c32-4b9b-a637-054e7a5234f4/download/tarifas-homologadas-distribuidoras-energia-eletrica.csv";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let tarifasCachePorSig = construirFallbackCache();
let ultimaSincronizacao = 0;
let sincronizacaoEmAndamento = null;

function dividirLinhas(csv) {
  return String(csv || "")
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

function parseCsv(csv) {
  const linhas = dividirLinhas(csv);

  if (linhas.length < 2) {
    return [];
  }

  const cabecalhos = linhas[0].split(";").map((coluna) => coluna.trim());
  return linhas.slice(1).map((linha) => {
    const valores = linha.split(";").map((coluna) => coluna.trim());
    const item = {};

    cabecalhos.forEach((cabecalho, indice) => {
      item[cabecalho] = valores[indice] || "";
    });

    return item;
  });
}

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarTextoComparacao(texto) {
  return removerAcentos(texto).trim().toUpperCase();
}

function parseDataFlexivel(data) {
  const valor = String(data || "").trim();

  if (!valor) {
    return null;
  }

  const timestampISO = Date.parse(valor);
  if (!Number.isNaN(timestampISO)) {
    return timestampISO;
  }

  const matchDataBr = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!matchDataBr) {
    return null;
  }

  const dia = Number(matchDataBr[1]);
  const mes = Number(matchDataBr[2]);
  const ano = Number(matchDataBr[3]);

  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano)) {
    return null;
  }

  return Date.UTC(ano, mes - 1, dia);
}

function parseNumeroPtBr(valor) {
  const texto = String(valor || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!texto) {
    return Number.NaN;
  }

  return Number(texto);
}

function arredondarCincoCasas(valor) {
  return Number(valor.toFixed(5));
}

function ehRegraB1Convencional(item) {
  const baseTarifaria = normalizarTextoComparacao(item.DscBaseTarifaria);
  const subGrupo = normalizarTextoComparacao(item.DscSubGrupo);
  const modalidade = normalizarTextoComparacao(item.DscModalidadeTarifaria);

  return (
    baseTarifaria === "TARIFA DE APLICACAO" &&
    subGrupo === "B1" &&
    modalidade === "CONVENCIONAL"
  );
}

function registroEstaVigente(dataInicio, dataFim, referenciaTimestamp) {
  if (!dataInicio) {
    return false;
  }

  if (dataInicio > referenciaTimestamp) {
    return false;
  }

  if (dataFim && dataFim < referenciaTimestamp) {
    return false;
  }

  return true;
}

function acumularRegistroTarifa(porAgente, item, dataInicio, tarifaKwh) {
  const sigAgente = String(item.SigAgente || "").trim();
  if (!sigAgente) {
    return;
  }

  const chave = normalizarChave(sigAgente);
  const anterior = porAgente[chave];

  if (!anterior || dataInicio >= anterior.dataInicioVigencia) {
    porAgente[chave] = {
      sigAgente,
      tarifaKwh,
      dataInicioVigencia: dataInicio,
      fonte: "aneel"
    };
  }
}

function extrairTarifasVigentes(registros, referenciaTimestamp = Date.now()) {
  const porAgente = {};

  registros.forEach((item) => {
    if (!ehRegraB1Convencional(item)) {
      return;
    }

    const dataInicio = parseDataFlexivel(item.DatInicioVigencia);
    const dataFim = parseDataFlexivel(item.DatFimVigencia);

    if (!registroEstaVigente(dataInicio, dataFim, referenciaTimestamp)) {
      return;
    }

    const valorTusd = parseNumeroPtBr(item.VlrTUSD);
    const valorTe = parseNumeroPtBr(item.VlrTE);

    if (!Number.isFinite(valorTusd) || !Number.isFinite(valorTe)) {
      return;
    }

    const tarifaKwh = arredondarCincoCasas((valorTusd + valorTe) / 1000);
    acumularRegistroTarifa(porAgente, item, dataInicio, tarifaKwh);
  });

  return porAgente;
}

function extrairTarifasMaisRecentes(registros) {
  const porAgente = {};

  registros.forEach((item) => {
    if (!ehRegraB1Convencional(item)) {
      return;
    }

    const dataInicio = parseDataFlexivel(item.DatInicioVigencia);
    const valorTusd = parseNumeroPtBr(item.VlrTUSD);
    const valorTe = parseNumeroPtBr(item.VlrTE);

    if (!dataInicio || !Number.isFinite(valorTusd) || !Number.isFinite(valorTe)) {
      return;
    }

    const tarifaKwh = arredondarCincoCasas((valorTusd + valorTe) / 1000);
    acumularRegistroTarifa(porAgente, item, dataInicio, tarifaKwh);
  });

  return porAgente;
}

function construirFallbackCache() {
  const porAgente = {};

  FALLBACK_TARIFAS.forEach((item) => {
    const sigAgente = resolverSigAgentePorNomeDistribuidora(item.distribuidora);
    const tarifaKwh = Number(item.tarifaKwh);

    if (!sigAgente || !Number.isFinite(tarifaKwh)) {
      return;
    }

    porAgente[normalizarChave(sigAgente)] = {
      sigAgente,
      tarifaKwh,
      dataInicioVigencia: null,
      fonte: "fallback_local"
    };
  });

  return porAgente;
}

async function baixarConteudoCsv(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao baixar CSV de tarifas da ANEEL. URL: ${url}`);
  }

  return response.text();
}

function toListaTarifas(cachePorSig) {
  return Object.values(cachePorSig).map((item) => {
    return {
      sigAgente: item.sigAgente,
      tarifaKwh: item.tarifaKwh,
      dataInicioVigencia: item.dataInicioVigencia,
      fonte: item.fonte
    };
  });
}

async function sincronizarComAneel() {
  const csvTarifas = await baixarConteudoCsv(URL_TARIFAS_ANEEL);
  const registros = parseCsv(csvTarifas);
  let tarifasExtraidas = extrairTarifasVigentes(registros);

  if (Object.keys(tarifasExtraidas).length === 0) {
    tarifasExtraidas = extrairTarifasMaisRecentes(registros);
  }

  if (Object.keys(tarifasExtraidas).length === 0) {
    throw new Error("Nao foi possivel extrair tarifas validas da base da ANEEL.");
  }

  tarifasCachePorSig = {
    ...construirFallbackCache(),
    ...tarifasExtraidas
  };

  ultimaSincronizacao = Date.now();
  return toListaTarifas(tarifasCachePorSig);
}

async function syncTarifasAneel(force = false) {
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    Date.now() - ultimaSincronizacao < CACHE_TTL_MS;

  if (cacheValido) {
    return toListaTarifas(tarifasCachePorSig);
  }

  if (sincronizacaoEmAndamento) {
    return sincronizacaoEmAndamento;
  }

  sincronizacaoEmAndamento = (async () => {
    try {
      return await sincronizarComAneel();
    } catch (error) {
      return toListaTarifas(tarifasCachePorSig);
    } finally {
      sincronizacaoEmAndamento = null;
    }
  })();

  return sincronizacaoEmAndamento;
}

function getTarifaBySigAgente(sigAgente) {
  const chave = normalizarChave(sigAgente);
  const tarifa = tarifasCachePorSig[chave];
  return tarifa ? { ...tarifa } : null;
}

function getTarifasCache() {
  return toListaTarifas(tarifasCachePorSig);
}

module.exports = {
  syncTarifasAneel,
  getTarifaBySigAgente,
  getTarifasCache,
  __internals: {
    parseCsv,
    parseDataFlexivel,
    parseNumeroPtBr,
    extrairTarifasVigentes,
    extrairTarifasMaisRecentes,
    ehRegraB1Convencional,
    construirFallbackCache
  }
};
