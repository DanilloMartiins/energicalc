const { readJson } = require("../utils/readJson");

const FALLBACK_BANDEIRA = readJson("data/bandeira.json");
const URL_BANDEIRA_ACIONAMENTO =
  "https://dadosabertos.aneel.gov.br/dataset/7f43a020-6dc5-44b8-80b4-d97eaa94436c/resource/0591b8f6-fe54-437b-b72b-1aa2efd46e42/download/bandeira-tarifaria-acionamento.csv";
const URL_BANDEIRA_ADICIONAL =
  "https://dadosabertos.aneel.gov.br/dataset/7f43a020-6dc5-44b8-80b4-d97eaa94436c/resource/5879ca80-b3bd-45b1-a135-d9b77c1d5b36/download/bandeira-tarifaria-adicional.csv";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let bandeiraCache = {
  vigente: FALLBACK_BANDEIRA.vigente,
  valoresKwh: { ...FALLBACK_BANDEIRA.valoresKwh }
};
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

function normalizarNomeBandeira(nome) {
  const texto = String(nome || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (texto.includes("vermelha") && texto.includes("p2")) {
    return "vermelha_p2";
  }

  if (texto.includes("vermelha") && texto.includes("p1")) {
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
  const response = await fetch(url);

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

  bandeiraCache = {
    vigente,
    valoresKwh: {
      ...FALLBACK_BANDEIRA.valoresKwh,
      ...valoresExtraidos
    }
  };

  ultimaSincronizacao = Date.now();
  return bandeiraCache;
}

async function syncBandeiraAtual(force = false) {
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    Date.now() - ultimaSincronizacao < CACHE_TTL_MS;

  if (cacheValido) {
    return bandeiraCache;
  }

  if (sincronizacaoEmAndamento) {
    return sincronizacaoEmAndamento;
  }

  sincronizacaoEmAndamento = (async () => {
    try {
      return await sincronizarComAneel();
    } catch (error) {
      return bandeiraCache;
    } finally {
      sincronizacaoEmAndamento = null;
    }
  })();

  return sincronizacaoEmAndamento;
}

function getBandeiraAtual() {
  return bandeiraCache;
}

module.exports = {
  getBandeiraAtual,
  syncBandeiraAtual
};
