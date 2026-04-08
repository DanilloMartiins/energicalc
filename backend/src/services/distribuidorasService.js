const distribuidorasData = require("../data/distribuidorasData");
const { resolverSigAgentePorCodigo } = require("../data/distribuidoraAneelMap");

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
  const todas = distribuidorasData.getDistribuidoras();
  const filtradas = aplicarFiltros(todas, filtros);

  if (filtros.page && filtros.limit) {
    return aplicarPaginacao(filtradas, filtros.page, filtros.limit);
  }

  return filtradas;
}

function obterDistribuidoraPorId(id) {
  return distribuidorasData.getDistribuidoraById(id);
}

function obterDistribuidoraPorNome(nome) {
  return distribuidorasData.getDistribuidoraByNome(nome);
}

function obterSigAgenteAneel(distribuidoraIdOuCodigo) {
  const distribuidora = obterDistribuidoraPorId(distribuidoraIdOuCodigo);

  if (!distribuidora) {
    return null;
  }

  return resolverSigAgentePorCodigo(distribuidora.codigo);
}

module.exports = {
  listarDistribuidoras,
  obterDistribuidoraPorId,
  obterDistribuidoraPorNome,
  obterSigAgenteAneel
};
