const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/readJson");
const {
  normalizarChave,
  resolverSigAgentePorNomeDistribuidora
} = require("./distribuidoraAneelMap");

const FALLBACK_TARIFAS = readJson("data/tarifas.json");
const TARIFAS_FALLBACK_FILE_PATH = process.env.TARIFAS_FALLBACK_FILE_PATH
  ? path.resolve(process.env.TARIFAS_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "tarifas.json");
const URL_TARIFAS_ANEEL =
  "https://dadosabertos.aneel.gov.br/dataset/5a583f3e-1646-4f67-bf0f-69db4203e89e/resource/fcf2906c-7c32-4b9b-a637-054e7a5234f4/download/tarifas-homologadas-distribuidoras-energia-eletrica.csv";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS_PADRAO = 5000;
const COOLDOWN_FALHA_MS = 5 * 60 * 1000;
const AUTO_PERSISTIR_FALLBACK_LOCAL =
  process.env.ANEEL_ATUALIZA_FALLBACK_LOCAL === "true" ||
  (process.env.NODE_ENV !== "test" && process.env.ANEEL_ATUALIZA_FALLBACK_LOCAL !== "false");

let tarifasFallbackLocal = carregarTarifasFallbackLocal();

let tarifasCachePorSig = construirFallbackCache();
let ultimaSincronizacao = 0;
let ultimaFalhaPorTimeout = 0;
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

function normalizarListaFallback(tarifas) {
  if (!Array.isArray(tarifas)) {
    return [];
  }

  return tarifas
    .map((item) => {
      const distribuidora = String(item && item.distribuidora ? item.distribuidora : "").trim();
      const tarifaKwh = Number(item && item.tarifaKwh);

      if (!distribuidora || !Number.isFinite(tarifaKwh)) {
        return null;
      }

      return {
        distribuidora,
        tarifaKwh: arredondarCincoCasas(tarifaKwh)
      };
    })
    .filter(Boolean);
}

function carregarTarifasFallbackLocal() {
  const fallbackNormalizado = normalizarListaFallback(FALLBACK_TARIFAS);

  try {
    const conteudo = fs.readFileSync(TARIFAS_FALLBACK_FILE_PATH, "utf-8");
    const arquivo = JSON.parse(conteudo);
    const normalizadoArquivo = normalizarListaFallback(arquivo);
    return normalizadoArquivo.length > 0 ? normalizadoArquivo : fallbackNormalizado;
  } catch (error) {
    return fallbackNormalizado;
  }
}

function persistirTarifasFallbackLocal(tarifasFallbackAtualizadas) {
  if (!AUTO_PERSISTIR_FALLBACK_LOCAL) {
    return;
  }

  const payload = `${JSON.stringify(tarifasFallbackAtualizadas, null, 2)}\n`;
  const tempPath = `${TARIFAS_FALLBACK_FILE_PATH}.tmp`;

  fs.writeFileSync(tempPath, payload, "utf-8");
  fs.renameSync(tempPath, TARIFAS_FALLBACK_FILE_PATH);
}

function atualizarTarifasFallbackLocalComAneel(tarifasExtraidasPorSig) {
  const fallbackAtualizado = tarifasFallbackLocal.map((item) => {
    const sigAgente = resolverSigAgentePorNomeDistribuidora(item.distribuidora);
    const chave = sigAgente ? normalizarChave(sigAgente) : "";
    const tarifaAneel = chave ? tarifasExtraidasPorSig[chave] : null;

    if (tarifaAneel && Number.isFinite(tarifaAneel.tarifaKwh)) {
      return {
        distribuidora: item.distribuidora,
        tarifaKwh: arredondarCincoCasas(tarifaAneel.tarifaKwh)
      };
    }

    return item;
  });

  tarifasFallbackLocal = fallbackAtualizado;

  try {
    persistirTarifasFallbackLocal(fallbackAtualizado);
  } catch (error) {
    // Falha de escrita local nao deve derrubar a sincronizacao da ANEEL.
  }
}

function construirFallbackCache() {
  const porAgente = {};

  tarifasFallbackLocal.forEach((item) => {
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
  const timeoutMsConfigurado = Number(process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(timeoutMsConfigurado) && timeoutMsConfigurado > 0
      ? timeoutMsConfigurado
      : FETCH_TIMEOUT_MS_PADRAO;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(
        `Timeout ao baixar CSV de tarifas da ANEEL apos ${timeoutMs}ms. URL: ${url}`
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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

function erroEhTimeout(error) {
  const mensagem = String((error && error.message) || "");
  return mensagem.toLowerCase().includes("timeout");
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

  atualizarTarifasFallbackLocalComAneel(tarifasExtraidas);

  tarifasCachePorSig = {
    ...construirFallbackCache(),
    ...tarifasExtraidas
  };

  ultimaSincronizacao = Date.now();
  return toListaTarifas(tarifasCachePorSig);
}

async function syncTarifasAneel(force = false) {
  const agora = Date.now();
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    agora - ultimaSincronizacao < CACHE_TTL_MS;
  const emCooldownFalha =
    !force &&
    ultimaFalhaPorTimeout > 0 &&
    agora - ultimaFalhaPorTimeout < COOLDOWN_FALHA_MS;

  if (cacheValido) {
    return toListaTarifas(tarifasCachePorSig);
  }

  if (emCooldownFalha) {
    return toListaTarifas(tarifasCachePorSig);
  }

  if (sincronizacaoEmAndamento) {
    return sincronizacaoEmAndamento;
  }

  sincronizacaoEmAndamento = (async () => {
    try {
      const resultado = await sincronizarComAneel();
      ultimaFalhaPorTimeout = 0;
      return resultado;
    } catch (error) {
      if (erroEhTimeout(error)) {
        ultimaFalhaPorTimeout = Date.now();
      }

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

function getStatusSincronizacao() {
  return {
    ultimaSincronizacao,
    ultimaFalhaPorTimeout
  };
}

module.exports = {
  syncTarifasAneel,
  getTarifaBySigAgente,
  getTarifasCache,
  getStatusSincronizacao,
  __internals: {
    parseCsv,
    parseDataFlexivel,
    parseNumeroPtBr,
    extrairTarifasVigentes,
    extrairTarifasMaisRecentes,
    ehRegraB1Convencional,
    construirFallbackCache,
    normalizarListaFallback,
    carregarTarifasFallbackLocal
  }
};
