const distribuidorasData = require("../data/distribuidorasData");
const distribuidorasCoberturaAneelData = require("../data/distribuidorasCoberturaAneelData");
const distribuidorasRepository = require("../repositories/distribuidorasRepository");
const { resolverSigAgentePorCodigo } = require("../data/distribuidoraAneelMap");

let ultimoMesSincronizadoCobertura = "";
let ultimoDiaTentativaSemSucessoCobertura = "";

function obterChaveMes(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function obterChaveDia(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function aplicarFiltroUf(distribuidoras, uf) {
  const ufNormalizada = String(uf || "").trim().toUpperCase();

  if (!ufNormalizada) {
    return distribuidoras;
  }

  return distribuidoras.filter((item) => {
    return String(item.uf || "").trim().toUpperCase() === ufNormalizada;
  });
}

function aplicarFiltroNome(distribuidoras, nome) {
  const nomeNormalizado = String(nome || "").trim().toLowerCase();

  if (!nomeNormalizado) {
    return distribuidoras;
  }

  return distribuidoras.filter((item) => {
    return String(item.nome || "").trim().toLowerCase().includes(nomeNormalizado);
  });
}

function aplicarFiltros(distribuidoras, filtros) {
  const comUf = aplicarFiltroUf(distribuidoras, filtros.uf);
  return aplicarFiltroNome(comUf, filtros.nome);
}

function aplicarPaginacao(distribuidoras, page, limit) {
  const totalItems = distribuidoras.length;
  const totalPages = Math.ceil(totalItems / limit);
  const inicio = (page - 1) * limit;
  const fim = inicio + limit;

  return {
    items: distribuidoras.slice(inicio, fim),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages
    }
  };
}

function listarDistribuidoras(filtros = {}) {
  const todas = distribuidorasRepository.listarDistribuidorasCache();
  const filtradas = aplicarFiltros(todas, filtros);

  if (filtros.page && filtros.limit) {
    return aplicarPaginacao(filtradas, filtros.page, filtros.limit);
  }

  return filtradas;
}

function obterDistribuidoraPorId(id) {
  return distribuidorasRepository.obterDistribuidoraPorIdOuCodigo(id);
}

function obterDistribuidoraPorNome(nome) {
  return distribuidorasRepository.obterDistribuidoraPorNome(nome);
}

function obterDistribuidoraPorCidadeUf(cidade, uf) {
  const codigoDistribuidora = distribuidorasRepository.resolverDistribuidoraCodigoPorCidadeUf(
    cidade,
    uf
  );

  if (!codigoDistribuidora) {
    return null;
  }

  return obterDistribuidoraPorId(codigoDistribuidora);
}

function obterSigAgenteAneel(distribuidoraIdOuCodigo) {
  const distribuidora = obterDistribuidoraPorId(distribuidoraIdOuCodigo);

  if (!distribuidora) {
    return null;
  }

  return resolverSigAgentePorCodigo(distribuidora.codigo);
}

async function sincronizarDistribuidorasAneel(force = false) {
  const listaAtualizada = await distribuidorasData.syncDistribuidorasAneel(force);
  const listaAtual = distribuidorasRepository.listarDistribuidorasCache();
  const porCodigo = new Map();

  listaAtual.forEach((item) => {
    porCodigo.set(String(item.codigo || "").trim().toUpperCase(), item);
  });

  listaAtualizada.forEach((item) => {
    porCodigo.set(String(item.codigo || "").trim().toUpperCase(), item);
  });

  return distribuidorasRepository.sincronizarListaDistribuidoras(Array.from(porCodigo.values()));
}

async function sincronizarCoberturaDistribuidorasAneel(force = false) {
  const snapshot = await distribuidorasCoberturaAneelData.syncCoberturaDistribuidorasAneel(force);

  await distribuidorasRepository.sincronizarListaDistribuidoras(snapshot.distribuidoras);
  await distribuidorasRepository.sincronizarCoberturaCidades(snapshot.cobertura);

  return snapshot;
}

function sincronizarCoberturaDistribuidorasAneelEmBackground(force = false) {
  sincronizarCoberturaDistribuidorasAneel(force).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

async function sincronizarCoberturaDistribuidorasNoMes(dataReferencia = new Date()) {
  const mesAtual = obterChaveMes(dataReferencia);
  const diaAtual = obterChaveDia(dataReferencia);

  if (mesAtual === ultimoMesSincronizadoCobertura) {
    return distribuidorasCoberturaAneelData.getSnapshotCache();
  }

  if (ultimoDiaTentativaSemSucessoCobertura === diaAtual) {
    return distribuidorasCoberturaAneelData.getSnapshotCache();
  }

  const statusAntes = distribuidorasCoberturaAneelData.getStatusSincronizacao();
  const snapshot = await sincronizarCoberturaDistribuidorasAneel(true);
  const statusDepois = distribuidorasCoberturaAneelData.getStatusSincronizacao();

  if (statusDepois.ultimaSincronizacao > statusAntes.ultimaSincronizacao) {
    ultimoMesSincronizadoCobertura = mesAtual;
    ultimoDiaTentativaSemSucessoCobertura = "";
  } else {
    ultimoDiaTentativaSemSucessoCobertura = diaAtual;
  }

  return snapshot;
}

function sincronizarCoberturaDistribuidorasNoMesEmBackground(dataReferencia = new Date()) {
  sincronizarCoberturaDistribuidorasNoMes(dataReferencia).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

function sincronizarDistribuidorasAneelEmBackground(force = false) {
  sincronizarDistribuidorasAneel(force).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

function inicializarDistribuidorasRepositoryEmBackground() {
  distribuidorasRepository.inicializarRepositorioEmBackground();
}

module.exports = {
  listarDistribuidoras,
  obterDistribuidoraPorId,
  obterDistribuidoraPorNome,
  obterDistribuidoraPorCidadeUf,
  obterSigAgenteAneel,
  sincronizarDistribuidorasAneel,
  sincronizarDistribuidorasAneelEmBackground,
  sincronizarCoberturaDistribuidorasAneel,
  sincronizarCoberturaDistribuidorasAneelEmBackground,
  sincronizarCoberturaDistribuidorasNoMes,
  sincronizarCoberturaDistribuidorasNoMesEmBackground,
  inicializarDistribuidorasRepositoryEmBackground
};
