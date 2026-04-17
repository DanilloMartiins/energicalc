const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/readJson");
const { normalizarChave, resolverSigAgentePorCodigo } = require("./distribuidoraAneelMap");
const tarifasAneelData = require("./tarifasAneelData");

const FALLBACK_DISTRIBUIDORAS = readJson("data/distribuidoras.json");
const DISTRIBUIDORAS_FALLBACK_FILE_PATH = process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH
  ? path.resolve(process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "distribuidoras.json");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const COOLDOWN_FALHA_MS = 5 * 60 * 1000;
const AUTO_PERSISTIR_FALLBACK_LOCAL =
  process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS === "true" ||
  (process.env.NODE_ENV !== "test" &&
    process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS !== "false");

let distribuidorasCache = carregarDistribuidorasFallbackLocal();
let ultimaSincronizacao = 0;
let ultimaFalha = 0;
let sincronizacaoEmAndamento = null;

function normalizarListaDistribuidoras(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const codigo = String(item && item.codigo ? item.codigo : "").trim();
      const nome = String(item && item.nome ? item.nome : "").trim();
      const uf = String(item && item.uf ? item.uf : "")
        .trim()
        .toUpperCase();

      if (!codigo || !nome || !uf) {
        return null;
      }

      return { codigo, nome, uf };
    })
    .filter(Boolean);
}

function mesclarListasDistribuidoras(basePadrao, preferencial) {
  const porCodigo = new Map();

  basePadrao.forEach((item) => {
    porCodigo.set(normalizarChave(item.codigo), item);
  });

  preferencial.forEach((item) => {
    porCodigo.set(normalizarChave(item.codigo), item);
  });

  return Array.from(porCodigo.values());
}

function carregarDistribuidorasFallbackLocal() {
  const fallbackNormalizado = normalizarListaDistribuidoras(FALLBACK_DISTRIBUIDORAS);

  try {
    const conteudo = fs.readFileSync(DISTRIBUIDORAS_FALLBACK_FILE_PATH, "utf-8");
    const arquivo = JSON.parse(conteudo);
    const normalizadoArquivo = normalizarListaDistribuidoras(arquivo);
    return mesclarListasDistribuidoras(fallbackNormalizado, normalizadoArquivo);
  } catch (error) {
    return fallbackNormalizado;
  }
}

function persistirDistribuidorasFallbackLocal(listaAtualizada) {
  if (!AUTO_PERSISTIR_FALLBACK_LOCAL) {
    return;
  }

  const payload = `${JSON.stringify(listaAtualizada, null, 2)}\n`;
  const tempPath = `${DISTRIBUIDORAS_FALLBACK_FILE_PATH}.tmp`;

  fs.writeFileSync(tempPath, payload, "utf-8");
  fs.renameSync(tempPath, DISTRIBUIDORAS_FALLBACK_FILE_PATH);
}

function atualizarDistribuidorasComTarifasAneel(distribuidorasBase, tarifas) {
  const sigsAneelDisponiveis = new Set(
    tarifas
      .filter((item) => item && item.fonte === "aneel")
      .map((item) => normalizarChave(item.sigAgente))
  );

  const atualizadas = distribuidorasBase.map((item) => {
    const sigAgente = resolverSigAgentePorCodigo(item.codigo);
    if (!sigAgente) {
      return item;
    }

    const existeNaAneel = sigsAneelDisponiveis.has(normalizarChave(sigAgente));
    if (!existeNaAneel) {
      return item;
    }

    // Mantemos contrato atual (codigo/nome/uf), apenas validando consistência com ANEEL.
    return { ...item };
  });

  return normalizarListaDistribuidoras(atualizadas);
}

async function sincronizarComAneel() {
  const tarifas = tarifasAneelData.getTarifasCache();
  const atualizadas = atualizarDistribuidorasComTarifasAneel(distribuidorasCache, tarifas);

  if (atualizadas.length === 0) {
    throw new Error("Não foi possível atualizar distribuidoras com dados da ANEEL.");
  }

  distribuidorasCache = atualizadas;

  try {
    persistirDistribuidorasFallbackLocal(atualizadas);
  } catch (error) {
    // Falha de escrita local não deve bloquear resposta da API.
  }

  ultimaSincronizacao = Date.now();
  return distribuidorasCache.map((item) => ({ ...item }));
}

async function syncDistribuidorasAneel(force = false) {
  const agora = Date.now();
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    agora - ultimaSincronizacao < CACHE_TTL_MS;
  const emCooldownFalha =
    !force &&
    ultimaFalha > 0 &&
    agora - ultimaFalha < COOLDOWN_FALHA_MS;

  if (cacheValido || emCooldownFalha) {
    return distribuidorasCache.map((item) => ({ ...item }));
  }

  if (sincronizacaoEmAndamento) {
    return sincronizacaoEmAndamento;
  }

  sincronizacaoEmAndamento = (async () => {
    try {
      const resultado = await sincronizarComAneel();
      ultimaFalha = 0;
      return resultado;
    } catch (error) {
      ultimaFalha = Date.now();
      return distribuidorasCache.map((item) => ({ ...item }));
    } finally {
      sincronizacaoEmAndamento = null;
    }
  })();

  return sincronizacaoEmAndamento;
}

function getDistribuidorasCache() {
  return distribuidorasCache.map((item) => ({ ...item }));
}

module.exports = {
  syncDistribuidorasAneel,
  getDistribuidorasCache,
  __internals: {
    normalizarListaDistribuidoras,
    mesclarListasDistribuidoras,
    carregarDistribuidorasFallbackLocal,
    atualizarDistribuidorasComTarifasAneel
  }
};
