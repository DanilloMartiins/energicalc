const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/readJson");

const FALLBACK_BANDEIRA = readJson("data/bandeira.json");
const BANDEIRA_FALLBACK_FILE_PATH = process.env.BANDEIRA_FALLBACK_FILE_PATH
  ? path.resolve(process.env.BANDEIRA_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "bandeira.json");
const URL_BANDEIRA_ACIONAMENTO =
  "https://dadosabertos.aneel.gov.br/dataset/7f43a020-6dc5-44b8-80b4-d97eaa94436c/resource/0591b8f6-fe54-437b-b72b-1aa2efd46e42/download/bandeira-tarifaria-acionamento.csv";
const URL_BANDEIRA_ADICIONAL =
  "https://dadosabertos.aneel.gov.br/dataset/7f43a020-6dc5-44b8-80b4-d97eaa94436c/resource/5879ca80-b3bd-45b1-a135-d9b77c1d5b36/download/bandeira-tarifaria-adicional.csv";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS_PADRAO = 5000;
const COOLDOWN_FALHA_MS = 5 * 60 * 1000;
const AUTO_PERSISTIR_FALLBACK_LOCAL =
  process.env.ANEEL_ATUALIZA_FALLBACK_BANDEIRA === "true" ||
  (process.env.NODE_ENV !== "test" && process.env.ANEEL_ATUALIZA_FALLBACK_BANDEIRA !== "false");

let bandeiraFallbackLocal = carregarBandeiraFallbackLocal();

let bandeiraCache = {
  vigente: bandeiraFallbackLocal.vigente,
  valoresKwh: { ...bandeiraFallbackLocal.valoresKwh }
};
let ultimaSincronizacao = 0;
let ultimaFalha = 0;
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

function normalizarNomeBandeira(nome) {
  const texto = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  const ehVermelhaP2 =
    texto.includes("vermelha") &&
    (texto.includes("p2") || texto.includes("patamar 2"));
  const ehVermelhaP1 =
    texto.includes("vermelha") &&
    (texto.includes("p1") || texto.includes("patamar 1"));

  if (ehVermelhaP2) {
    return "vermelha_p2";
  }

  if (ehVermelhaP1) {
    return "vermelha_p1";
  }

  if (texto.includes("amarela")) {
    return "amarela";
  }

  if (texto.includes("verde")) {
    return "verde";
  }

  if (texto.includes("escassez")) {
    return "escassez_hidrica";
  }

  return texto.replace(/\s+/g, "_");
}

function parseDataISO(data) {
  const valor = String(data || "").trim();
  if (!valor) {
    return null;
  }

  const timestamp = Date.parse(valor);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function parseNumeroPtBr(valor) {
  let texto = String(valor || "")
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!texto) {
    return Number.NaN;
  }

  if (texto.startsWith(".")) {
    texto = `0${texto}`;
  }

  if (texto.startsWith("-.")) {
    texto = texto.replace("-.", "-0.");
  }

  return Number(texto);
}

function arredondarCincoCasas(valor) {
  return Number(valor.toFixed(5));
}

function normalizarBandeira(payload) {
  const vigente = normalizarNomeBandeira(payload && payload.vigente);
  const valoresEntrada = (payload && payload.valoresKwh) || {};
  const valoresKwh = {};

  Object.keys(valoresEntrada).forEach((tipo) => {
    const tipoNormalizado = normalizarNomeBandeira(tipo);
    const valor = Number(valoresEntrada[tipo]);
    if (tipoNormalizado && Number.isFinite(valor)) {
      valoresKwh[tipoNormalizado] = arredondarCincoCasas(valor);
    }
  });

  if (!Object.prototype.hasOwnProperty.call(valoresKwh, "verde")) {
    valoresKwh.verde = 0;
  }

  return {
    vigente: vigente || "verde",
    valoresKwh
  };
}

function carregarBandeiraFallbackLocal() {
  const fallbackNormalizado = normalizarBandeira(FALLBACK_BANDEIRA);

  try {
    const conteudo = fs.readFileSync(BANDEIRA_FALLBACK_FILE_PATH, "utf-8");
    const arquivo = JSON.parse(conteudo);
    const normalizadoArquivo = normalizarBandeira(arquivo);

    return {
      vigente: normalizadoArquivo.vigente || fallbackNormalizado.vigente,
      valoresKwh: {
        ...fallbackNormalizado.valoresKwh,
        ...normalizadoArquivo.valoresKwh
      }
    };
  } catch (error) {
    return fallbackNormalizado;
  }
}

function persistirBandeiraFallbackLocal(payload) {
  if (!AUTO_PERSISTIR_FALLBACK_LOCAL) {
    return;
  }

  const tempPath = `${BANDEIRA_FALLBACK_FILE_PATH}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tempPath, BANDEIRA_FALLBACK_FILE_PATH);
}

function extrairVigente(acionamentos) {
  let ultimoRegistro = null;

  acionamentos.forEach((item) => {
    const competencia = parseDataISO(item.DatCompetencia);
    if (!competencia) {
      return;
    }

    if (!ultimoRegistro || competencia >= ultimoRegistro.competencia) {
      ultimoRegistro = {
        competencia,
        nome: item.NomBandeiraAcionada
      };
    }
  });

  if (!ultimoRegistro) {
    return null;
  }

  return normalizarNomeBandeira(ultimoRegistro.nome);
}

function extrairValoresKwh(adicionais) {
  const porTipo = {};

  adicionais.forEach((item) => {
    const tipo = normalizarNomeBandeira(item.NomBandeiraAcionada);
    const vigencia = parseDataISO(item.DatVigencia);
    const valorMwh = parseNumeroPtBr(item.VlrAdicionalBandeiraRSMWh);

    if (!tipo || !vigencia || !Number.isFinite(valorMwh)) {
      return;
    }

    const anterior = porTipo[tipo];
    if (!anterior || vigencia >= anterior.vigencia) {
      porTipo[tipo] = {
        vigencia,
        valorKwh: arredondarCincoCasas(valorMwh / 1000)
      };
    }
  });

  const valoresKwh = {};
  Object.keys(porTipo).forEach((tipo) => {
    valoresKwh[tipo] = porTipo[tipo].valorKwh;
  });

  if (!Object.prototype.hasOwnProperty.call(valoresKwh, "verde")) {
    valoresKwh.verde = 0;
  }

  return valoresKwh;
}

async function baixarConteudoCsv(url) {
  const timeoutMsConfigurado = Number(process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS);
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
      throw new Error(`Timeout ao baixar CSV da ANEEL apos ${timeoutMs}ms. URL: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Falha ao baixar CSV da ANEEL. URL: ${url}`);
  }

  return response.text();
}

async function sincronizarComAneel() {
  const [csvAcionamento, csvAdicional] = await Promise.all([
    baixarConteudoCsv(URL_BANDEIRA_ACIONAMENTO),
    baixarConteudoCsv(URL_BANDEIRA_ADICIONAL)
  ]);

  const acionamentos = parseCsv(csvAcionamento);
  const adicionais = parseCsv(csvAdicional);
  const vigente = extrairVigente(acionamentos);
  const valoresExtraidos = extrairValoresKwh(adicionais);

  if (!vigente) {
    throw new Error("Nao foi possivel identificar a bandeira vigente na base da ANEEL.");
  }

  const bandeiraAtualizada = {
    vigente,
    valoresKwh: {
      ...bandeiraFallbackLocal.valoresKwh,
      ...valoresExtraidos
    }
  };

  bandeiraCache = normalizarBandeira(bandeiraAtualizada);
  bandeiraFallbackLocal = { ...bandeiraCache, valoresKwh: { ...bandeiraCache.valoresKwh } };

  try {
    persistirBandeiraFallbackLocal(bandeiraCache);
  } catch (error) {
    // Falha de escrita local nao deve derrubar resposta da API.
  }

  ultimaSincronizacao = Date.now();
  return bandeiraCache;
}

async function syncBandeiraAtual(force = false) {
  const agora = Date.now();
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    agora - ultimaSincronizacao < CACHE_TTL_MS;
  const emCooldownFalha =
    !force &&
    ultimaFalha > 0 &&
    agora - ultimaFalha < COOLDOWN_FALHA_MS;

  if (cacheValido) {
    return bandeiraCache;
  }

  if (emCooldownFalha) {
    return bandeiraCache;
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
      return bandeiraCache;
    } finally {
      sincronizacaoEmAndamento = null;
    }
  })();

  return sincronizacaoEmAndamento;
}

function getBandeiraAtual() {
  return {
    vigente: bandeiraCache.vigente,
    valoresKwh: { ...bandeiraCache.valoresKwh }
  };
}

function getStatusSincronizacao() {
  return {
    ultimaSincronizacao,
    ultimaFalha
  };
}

module.exports = {
  getBandeiraAtual,
  syncBandeiraAtual,
  getStatusSincronizacao,
  __internals: {
    parseCsv,
    normalizarBandeira,
    carregarBandeiraFallbackLocal
  }
};
