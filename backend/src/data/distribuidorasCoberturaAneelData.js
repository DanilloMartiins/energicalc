const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/readJson");
const {
  normalizarChave,
  resolverCodigoPorSigAgente
} = require("./distribuidoraAneelMap");

const FALLBACK_DISTRIBUIDORAS = readJson("data/distribuidoras.json");
const FALLBACK_COBERTURA = readJson("data/distribuidorasCobertura.json");

const DISTRIBUIDORAS_FALLBACK_FILE_PATH = process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH
  ? path.resolve(process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "distribuidoras.json");
const COBERTURA_FALLBACK_FILE_PATH = process.env.DISTRIBUIDORAS_COBERTURA_FALLBACK_FILE_PATH
  ? path.resolve(process.env.DISTRIBUIDORAS_COBERTURA_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "distribuidorasCobertura.json");

const URL_INDQUAL_MUNICIPIO =
  "https://dadosabertos.aneel.gov.br/dataset/db9c9f60-b3b5-4504-9dfe-2637922d53ce/resource/3f841488-80a8-42f2-a6ca-e0c593b228de/download/indqual-municipio.csv";
const URL_COLETIVOS_ATRIBUTOS =
  "https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/3c780aca-38cf-406d-9d45-f07a9216eef2/download/indicadores-continuidade-coletivos-atributos.csv";
const URL_AGENTES_SETOR =
  "https://dadosabertos.aneel.gov.br/dataset/71d1007e-7e14-4875-8758-7e3a0d1118df/resource/64250fc9-4f7a-4d97-b0d4-3c090e005e1c/download/agentes-setor-eletrico.csv";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS_PADRAO = 20000;
const COOLDOWN_FALHA_MS = 5 * 60 * 1000;
const AUTO_PERSISTIR_FALLBACK_LOCAL =
  process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS === "true" ||
  (process.env.NODE_ENV !== "test" &&
    process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS !== "false");

let dadosCache = carregarFallbackLocal();
let ultimaSincronizacao = 0;
let ultimaFalha = 0;
let sincronizacaoEmAndamento = null;

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarCidade(cidade) {
  return removerAcentos(cidade)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizarUf(uf) {
  return removerAcentos(uf).trim().toUpperCase();
}

function limparTextoSimples(valor) {
  return String(valor || "")
    .trim()
    .replace(/^'+|'+$/g, "")
    .replace(/\s+/g, " ");
}

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

function parseDataISO(data) {
  const valor = String(data || "").trim();
  if (!valor) {
    return null;
  }

  const timestamp = Date.parse(valor);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function normalizarListaDistribuidoras(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const codigo = String(item && item.codigo ? item.codigo : "").trim().toUpperCase();
      const nome = limparTextoSimples(item && item.nome);
      const uf = normalizarUf(item && item.uf);

      if (!codigo || !nome || !uf) {
        return null;
      }

      return { codigo, nome, uf };
    })
    .filter(Boolean);
}

function normalizarListaCobertura(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const uf = normalizarUf(item && item.uf);
      const cidade = limparTextoSimples(item && item.cidade);
      const codMunicipio = String(item && item.codMunicipio ? item.codMunicipio : "").trim();
      const distribuidoraCodigo = String(
        item && item.distribuidoraCodigo ? item.distribuidoraCodigo : ""
      )
        .trim()
        .toUpperCase();

      if (!uf || !cidade || !distribuidoraCodigo) {
        return null;
      }

      return {
        uf,
        cidade,
        codMunicipio,
        distribuidoraCodigo
      };
    })
    .filter(Boolean);
}

function mesclarDistribuidoras(base, preferencial) {
  const porCodigo = new Map();

  base.forEach((item) => {
    porCodigo.set(normalizarChave(item.codigo), item);
  });

  preferencial.forEach((item) => {
    porCodigo.set(normalizarChave(item.codigo), item);
  });

  return Array.from(porCodigo.values());
}

function mesclarCobertura(base, preferencial) {
  const porCidadeUf = new Map();

  base.forEach((item) => {
    const chave = `${item.uf}|${normalizarCidade(item.cidade)}`;
    porCidadeUf.set(chave, item);
  });

  preferencial.forEach((item) => {
    const chave = `${item.uf}|${normalizarCidade(item.cidade)}`;
    porCidadeUf.set(chave, item);
  });

  return Array.from(porCidadeUf.values());
}

function carregarFallbackLocal() {
  const baseDistribuidoras = normalizarListaDistribuidoras(FALLBACK_DISTRIBUIDORAS);
  const baseCobertura = normalizarListaCobertura(FALLBACK_COBERTURA);

  let arquivoDistribuidoras = [];
  let arquivoCobertura = [];

  try {
    const conteudo = fs.readFileSync(DISTRIBUIDORAS_FALLBACK_FILE_PATH, "utf-8");
    arquivoDistribuidoras = normalizarListaDistribuidoras(JSON.parse(conteudo));
  } catch (error) {
    arquivoDistribuidoras = [];
  }

  try {
    const conteudo = fs.readFileSync(COBERTURA_FALLBACK_FILE_PATH, "utf-8");
    arquivoCobertura = normalizarListaCobertura(JSON.parse(conteudo));
  } catch (error) {
    arquivoCobertura = [];
  }

  return {
    distribuidoras: mesclarDistribuidoras(baseDistribuidoras, arquivoDistribuidoras),
    cobertura: mesclarCobertura(baseCobertura, arquivoCobertura)
  };
}

function persistirJsonAtomico(caminhoArquivo, payload) {
  const tempPath = `${caminhoArquivo}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  fs.renameSync(tempPath, caminhoArquivo);
}

function persistirFallbackLocal(snapshot) {
  if (!AUTO_PERSISTIR_FALLBACK_LOCAL) {
    return;
  }

  persistirJsonAtomico(DISTRIBUIDORAS_FALLBACK_FILE_PATH, snapshot.distribuidoras);
  persistirJsonAtomico(COBERTURA_FALLBACK_FILE_PATH, snapshot.cobertura);
}

async function baixarConteudoCsv(url) {
  const timeoutMsConfigurado = Number(process.env.ANEEL_DISTRIBUIDORAS_FETCH_TIMEOUT_MS);
  const timeoutMs =
    Number.isFinite(timeoutMsConfigurado) && timeoutMsConfigurado > 0
      ? timeoutMsConfigurado
      : FETCH_TIMEOUT_MS_PADRAO;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Timeout ao baixar CSV da ANEEL após ${timeoutMs}ms. URL: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Falha ao baixar CSV da ANEEL. URL: ${url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const textoUtf8 = buffer.toString("utf8");
  const quantidadeCaracteresInvalidos = (textoUtf8.match(/\uFFFD/g) || []).length;

  if (quantidadeCaracteresInvalidos > 10) {
    return buffer.toString("latin1");
  }

  return textoUtf8;
}

function identificarDataMaisRecente(registros, campoData) {
  let maiorData = null;

  registros.forEach((item) => {
    const data = parseDataISO(item[campoData]);
    if (!data) {
      return;
    }

    if (!maiorData || data > maiorData) {
      maiorData = data;
    }
  });

  return maiorData;
}

function construirMapaIdeConjPorSigAgente(registrosAtributos) {
  const dataMaisRecente = identificarDataMaisRecente(
    registrosAtributos,
    "DatGeracaoConjuntoDados"
  );
  const porConjunto = new Map();

  registrosAtributos.forEach((item) => {
    const dataRegistro = parseDataISO(item.DatGeracaoConjuntoDados);
    if (!dataMaisRecente || !dataRegistro || dataRegistro !== dataMaisRecente) {
      return;
    }

    const ideConj = String(item.IdeConjUndConsumidoras || "").trim();
    const sigAgente = limparTextoSimples(item.SigAgente);

    if (!ideConj || !sigAgente || porConjunto.has(ideConj)) {
      return;
    }

    porConjunto.set(ideConj, sigAgente);
  });

  return porConjunto;
}

function construirMapaSigAgenteParaNomeDistribuidora(registrosAgentes) {
  const porSigAgente = new Map();

  registrosAgentes.forEach((item) => {
    const ativo = String(item.IdcAtivo || "").trim().toUpperCase();
    const distribui = String(item.IdcDistribuicao || "").trim();

    if (ativo !== "A" || distribui !== "1") {
      return;
    }

    const sigPessoa = limparTextoSimples(item.SigPessoa);
    const nomeRazaoSocial = limparTextoSimples(item.NomRazaoSocial);
    if (!sigPessoa || !nomeRazaoSocial) {
      return;
    }

    const chave = normalizarChave(sigPessoa);
    if (!chave || porSigAgente.has(chave)) {
      return;
    }

    porSigAgente.set(chave, nomeRazaoSocial);
  });

  return porSigAgente;
}

function montarSnapshot(registrosMunicipios, mapaIdeConjParaSigAgente, mapaNomePorSig) {
  const dataMunicipioMaisRecente = identificarDataMaisRecente(
    registrosMunicipios,
    "DatGeracaoConjuntoDados"
  );
  const coberturaPorCidade = new Map();
  const sigAgenteParaUfs = new Map();

  registrosMunicipios.forEach((item) => {
    const dataRegistro = parseDataISO(item.DatGeracaoConjuntoDados);
    if (!dataMunicipioMaisRecente || !dataRegistro || dataRegistro !== dataMunicipioMaisRecente) {
      return;
    }

    const uf = normalizarUf(item.SigUF);
    const cidade = limparTextoSimples(item.NomMunicipio);
    const codMunicipio = String(item.CodMunicipio || "").trim();
    const ideConj = String(item.IdeConjUnidConsumidoras || "").trim();
    const sigAgente = mapaIdeConjParaSigAgente.get(ideConj);

    if (!uf || !cidade || !ideConj || !sigAgente) {
      return;
    }

    const chaveCidade = `${uf}|${normalizarCidade(cidade)}`;
    if (!coberturaPorCidade.has(chaveCidade)) {
      coberturaPorCidade.set(chaveCidade, {
        uf,
        cidade,
        codMunicipio,
        sigAgente
      });
    }

    const chaveSig = normalizarChave(sigAgente);
    if (!sigAgenteParaUfs.has(chaveSig)) {
      sigAgenteParaUfs.set(chaveSig, new Set());
    }

    sigAgenteParaUfs.get(chaveSig).add(uf);
  });

  const distribuidorasBase = normalizarListaDistribuidoras(FALLBACK_DISTRIBUIDORAS);
  const distribuidorasPorCodigo = new Map();
  const codigoPorSig = new Map();

  distribuidorasBase.forEach((item) => {
    const codigoNormalizado = normalizarChave(item.codigo);
    distribuidorasPorCodigo.set(codigoNormalizado, item);
  });

  Array.from(coberturaPorCidade.values()).forEach((item) => {
    const sigAgente = item.sigAgente;
    const codigo = resolverCodigoPorSigAgente(sigAgente);

    if (!codigo) {
      return;
    }

    const chaveCodigo = normalizarChave(codigo);
    const chaveSig = normalizarChave(sigAgente);
    codigoPorSig.set(chaveSig, codigo);

    if (!distribuidorasPorCodigo.has(chaveCodigo)) {
      const ufsAtendidas = sigAgenteParaUfs.get(chaveSig) || new Set();
      const ufRepresentativa = ufsAtendidas.size === 1 ? Array.from(ufsAtendidas)[0] : "BR";
      const nomeMapeado = mapaNomePorSig.get(chaveSig);

      distribuidorasPorCodigo.set(chaveCodigo, {
        codigo,
        nome: nomeMapeado || sigAgente,
        uf: ufRepresentativa
      });
    }
  });

  const cobertura = Array.from(coberturaPorCidade.values())
    .map((item) => {
      const codigo = codigoPorSig.get(normalizarChave(item.sigAgente));
      if (!codigo) {
        return null;
      }

      return {
        uf: item.uf,
        cidade: item.cidade,
        codMunicipio: item.codMunicipio,
        distribuidoraCodigo: codigo
      };
    })
    .filter(Boolean);

  const distribuidoras = Array.from(distribuidorasPorCodigo.values());

  return {
    distribuidoras: normalizarListaDistribuidoras(distribuidoras),
    cobertura: normalizarListaCobertura(cobertura)
  };
}

function toSnapshotClone(snapshot) {
  return {
    distribuidoras: snapshot.distribuidoras.map((item) => ({ ...item })),
    cobertura: snapshot.cobertura.map((item) => ({ ...item }))
  };
}

function erroEhTimeout(error) {
  const mensagem = String((error && error.message) || "");
  return mensagem.toLowerCase().includes("timeout");
}

async function sincronizarComAneel() {
  const [csvMunicipios, csvAtributos, csvAgentes] = await Promise.all([
    baixarConteudoCsv(URL_INDQUAL_MUNICIPIO),
    baixarConteudoCsv(URL_COLETIVOS_ATRIBUTOS),
    baixarConteudoCsv(URL_AGENTES_SETOR)
  ]);

  const registrosMunicipios = parseCsv(csvMunicipios);
  const registrosAtributos = parseCsv(csvAtributos);
  const registrosAgentes = parseCsv(csvAgentes);

  const mapaIdeConjParaSigAgente = construirMapaIdeConjPorSigAgente(registrosAtributos);
  const mapaNomePorSig = construirMapaSigAgenteParaNomeDistribuidora(registrosAgentes);
  const snapshot = montarSnapshot(registrosMunicipios, mapaIdeConjParaSigAgente, mapaNomePorSig);

  if (snapshot.distribuidoras.length === 0 || snapshot.cobertura.length === 0) {
    throw new Error("Não foi possível montar snapshot de distribuidoras/cobertura da ANEEL.");
  }

  dadosCache = snapshot;

  try {
    persistirFallbackLocal(snapshot);
  } catch (error) {
    // Falha de escrita local não deve bloquear resposta da API.
  }

  ultimaSincronizacao = Date.now();
  return toSnapshotClone(snapshot);
}

async function syncCoberturaDistribuidorasAneel(force = false) {
  const agora = Date.now();
  const cacheValido =
    !force &&
    ultimaSincronizacao > 0 &&
    agora - ultimaSincronizacao < CACHE_TTL_MS;
  const emCooldownFalha = !force && ultimaFalha > 0 && agora - ultimaFalha < COOLDOWN_FALHA_MS;

  if (cacheValido || emCooldownFalha) {
    return toSnapshotClone(dadosCache);
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
      if (erroEhTimeout(error)) {
        ultimaFalha = Date.now();
      } else {
        ultimaFalha = Date.now();
      }

      return toSnapshotClone(dadosCache);
    } finally {
      sincronizacaoEmAndamento = null;
    }
  })();

  return sincronizacaoEmAndamento;
}

function getSnapshotCache() {
  return toSnapshotClone(dadosCache);
}

function getStatusSincronizacao() {
  return {
    ultimaSincronizacao,
    ultimaFalha
  };
}

module.exports = {
  syncCoberturaDistribuidorasAneel,
  getSnapshotCache,
  getStatusSincronizacao,
  __internals: {
    parseCsv,
    normalizarListaDistribuidoras,
    normalizarListaCobertura,
    construirMapaIdeConjPorSigAgente,
    construirMapaSigAgenteParaNomeDistribuidora,
    montarSnapshot
  }
};
