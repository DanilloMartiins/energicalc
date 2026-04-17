const fs = require("fs");
const path = require("path");

const CIP_FILE_PATH = process.env.CIP_FILE_PATH
  ? path.resolve(process.env.CIP_FILE_PATH)
  : path.resolve(__dirname, "cip.json");
const CIP_PROGRESS_FILE_PATH = process.env.CIP_PROGRESS_FILE_PATH
  ? path.resolve(process.env.CIP_PROGRESS_FILE_PATH)
  : path.resolve(__dirname, "cipProgress.json");

const MODELOS_COBRANCA_VALIDOS = new Set([
  "valor_fixo",
  "faixa_consumo",
  "percentual_consumo",
  "mista"
]);
const CONFIANCAS_VALIDAS = new Set(["alta", "media", "baixa"]);
const STATUS_PERSISTIVEIS = new Set(["oficial", "estimado"]);

const PESO_CONFIANCA = {
  baixa: 1,
  media: 2,
  alta: 3
};

let cipCache = null;

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarUf(uf) {
  return removerAcentos(uf).trim().toUpperCase();
}

function normalizarMunicipio(municipio) {
  return removerAcentos(municipio)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizarNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function garantirArquivoJson(pathArquivo) {
  if (fs.existsSync(pathArquivo)) {
    return;
  }

  const pasta = path.dirname(pathArquivo);
  if (!fs.existsSync(pasta)) {
    fs.mkdirSync(pasta, { recursive: true });
  }

  fs.writeFileSync(pathArquivo, "[]\n", "utf8");
}

function carregarLista(pathArquivo) {
  garantirArquivoJson(pathArquivo);

  try {
    const conteudo = fs.readFileSync(pathArquivo, "utf8");
    const payload = JSON.parse(conteudo);
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    return [];
  }
}

function salvarLista(pathArquivo, lista) {
  const tempPath = `${pathArquivo}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(lista, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, pathArquivo);
}

function normalizarLei(lei) {
  if (!lei || typeof lei !== "object") {
    return null;
  }

  const numero = String(lei.numero || "").trim();
  const descricao = String(lei.descricao || "").trim();
  const fonte = String(lei.fonte || "").trim();

  if (!numero && !descricao && !fonte) {
    return null;
  }

  return { numero, descricao, fonte };
}

function normalizarValores(valores) {
  if (!Array.isArray(valores)) {
    return [];
  }

  return valores
    .map((item) => {
      const faixaMin = normalizarNumero(item && item.faixa_kwh_min);
      const faixaMax = normalizarNumero(item && item.faixa_kwh_max);
      const valor = normalizarNumero(item && item.valor);

      if (faixaMin === null && faixaMax === null && valor === null) {
        return null;
      }

      return {
        faixa_kwh_min: faixaMin,
        faixa_kwh_max: faixaMax,
        valor: valor === null ? 0 : Number(valor.toFixed(4))
      };
    })
    .filter(Boolean);
}

function inferirStatusRegistro({ statusInformado, lei, fonteOficial }) {
  const normalizado = String(statusInformado || "").trim().toLowerCase();
  if (STATUS_PERSISTIVEIS.has(normalizado)) {
    return normalizado;
  }

  if (fonteOficial) {
    return "oficial";
  }

  if (lei && (lei.numero || lei.fonte)) {
    return "oficial";
  }

  return "estimado";
}

function normalizarRegistroCip(registro) {
  const municipio = String(registro && registro.municipio ? registro.municipio : "")
    .trim()
    .replace(/\s+/g, " ");
  const uf = normalizarUf(registro && registro.uf);

  if (!municipio || !uf) {
    return null;
  }

  const lei = normalizarLei(registro && registro.lei);
  const fonteOficial = Boolean(registro && registro.fonte_oficial);
  const status = inferirStatusRegistro({
    statusInformado: registro && registro.status,
    lei,
    fonteOficial
  });
  if (!STATUS_PERSISTIVEIS.has(status)) {
    return null;
  }

  const codigoMunicipioIBGE = String(
    registro && registro.codigoMunicipioIBGE ? registro.codigoMunicipioIBGE : ""
  )
    .trim()
    .replace(/\D/g, "");
  const modeloCobranca = String(
    registro && registro.modeloCobranca ? registro.modeloCobranca : ""
  )
    .trim()
    .toLowerCase();
  const confianca = String(registro && registro.confianca ? registro.confianca : "baixa")
    .trim()
    .toLowerCase();
  const ultimaAtualizacao = String(
    registro && registro.ultima_atualizacao ? registro.ultima_atualizacao : ""
  ).trim();

  return {
    municipio,
    uf,
    codigoMunicipioIBGE,
    lei,
    modeloCobranca: MODELOS_COBRANCA_VALIDOS.has(modeloCobranca)
      ? modeloCobranca
      : "mista",
    valores: normalizarValores(registro && registro.valores),
    observacoes: String(registro && registro.observacoes ? registro.observacoes : "").trim(),
    fonte_oficial: status === "oficial" ? fonteOficial : false,
    ultima_atualizacao: ultimaAtualizacao || new Date().toISOString(),
    confianca: CONFIANCAS_VALIDAS.has(confianca) ? confianca : "baixa",
    status
  };
}

function montarChaveCidadeUf(municipio, uf) {
  return `${normalizarUf(uf)}|${normalizarMunicipio(municipio)}`;
}

function getScoreConfianca(confianca) {
  return PESO_CONFIANCA[String(confianca || "").toLowerCase()] || 0;
}

function escolherRegistroPreferencial(atual, novo) {
  if (atual.status === "oficial" && novo.status !== "oficial") {
    return atual;
  }

  if (atual.status !== "oficial" && novo.status === "oficial") {
    return novo;
  }

  const scoreAtual = getScoreConfianca(atual.confianca);
  const scoreNovo = getScoreConfianca(novo.confianca);
  if (scoreNovo > scoreAtual) {
    return novo;
  }

  if (scoreAtual > scoreNovo) {
    return atual;
  }

  const dataAtual = Date.parse(atual.ultima_atualizacao || "");
  const dataNova = Date.parse(novo.ultima_atualizacao || "");

  if (Number.isFinite(dataNova) && Number.isFinite(dataAtual)) {
    return dataNova >= dataAtual ? novo : atual;
  }

  if (Number.isFinite(dataNova)) {
    return novo;
  }

  return atual;
}

function consolidarRegistrosPorCidadeUf(registros) {
  const porChave = new Map();

  registros.forEach((item) => {
    const chave = montarChaveCidadeUf(item.municipio, item.uf);
    const atual = porChave.get(chave);

    if (!atual) {
      porChave.set(chave, item);
      return;
    }

    porChave.set(chave, escolherRegistroPreferencial(atual, item));
  });

  return Array.from(porChave.values());
}

function ordenarLista(registros) {
  return [...registros].sort((a, b) => {
    return montarChaveCidadeUf(a.municipio, a.uf).localeCompare(
      montarChaveCidadeUf(b.municipio, b.uf),
      "pt-BR"
    );
  });
}

function carregarCache() {
  const lista = carregarLista(CIP_FILE_PATH)
    .map((item) => normalizarRegistroCip(item))
    .filter(Boolean);
  cipCache = ordenarLista(consolidarRegistrosPorCidadeUf(lista));
  return cipCache;
}

function cloneRegistro(item) {
  return {
    ...item,
    lei: item.lei ? { ...item.lei } : null,
    valores: Array.isArray(item.valores) ? item.valores.map((v) => ({ ...v })) : []
  };
}

function getCipCache() {
  if (!cipCache) {
    carregarCache();
  }

  return cipCache.map((item) => cloneRegistro(item));
}

function upsertRegistrosCip(registros) {
  const atuais = getCipCache();
  const porChave = new Map();

  atuais.forEach((item) => {
    porChave.set(montarChaveCidadeUf(item.municipio, item.uf), item);
  });

  (Array.isArray(registros) ? registros : [])
    .map((item) => normalizarRegistroCip(item))
    .filter(Boolean)
    .forEach((item) => {
      const chave = montarChaveCidadeUf(item.municipio, item.uf);
      const existente = porChave.get(chave);

      if (!existente) {
        porChave.set(chave, item);
        return;
      }

      porChave.set(chave, escolherRegistroPreferencial(existente, item));
    });

  const listaFinal = ordenarLista(Array.from(porChave.values()));
  salvarLista(CIP_FILE_PATH, listaFinal);
  cipCache = listaFinal;
  return getCipCache();
}

function encontrarCipPorCidadeUf(cidade, uf) {
  const chaveBusca = montarChaveCidadeUf(cidade, uf);
  const lista = getCipCache();
  return lista.find((item) => montarChaveCidadeUf(item.municipio, item.uf) === chaveBusca) || null;
}

function registrarProgressoColeta(evento) {
  const registros = carregarLista(CIP_PROGRESS_FILE_PATH);
  registros.push({
    municipio: String(evento && evento.municipio ? evento.municipio : "").trim(),
    uf: normalizarUf(evento && evento.uf),
    status: String(evento && evento.status ? evento.status : "pendente").trim().toLowerCase(),
    fonte: String(evento && evento.fonte ? evento.fonte : "").trim() || null,
    mensagem: String(evento && evento.mensagem ? evento.mensagem : "").trim(),
    data: new Date().toISOString()
  });
  salvarLista(CIP_PROGRESS_FILE_PATH, registros);
}

module.exports = {
  getCipCache,
  encontrarCipPorCidadeUf,
  upsertRegistrosCip,
  registrarProgressoColeta,
  normalizarUf,
  normalizarMunicipio,
  montarChaveCidadeUf,
  __internals: {
    normalizarRegistroCip,
    escolherRegistroPreferencial,
    consolidarRegistrosPorCidadeUf
  }
};
