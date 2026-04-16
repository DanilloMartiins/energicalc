const { readJson } = require("../utils/readJson");

const COBERTURA_PADRAO = readJson("data/distribuidorasCobertura.json");

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarUf(uf) {
  return removerAcentos(uf).trim().toUpperCase();
}

function normalizarCidade(cidade) {
  return removerAcentos(cidade)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizarListaCobertura(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const uf = normalizarUf(item && item.uf);
      const cidade = normalizarCidade(item && item.cidade);
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
        distribuidoraCodigo
      };
    })
    .filter(Boolean);
}

function getCoberturaPadrao() {
  return normalizarListaCobertura(COBERTURA_PADRAO).map((item) => ({ ...item }));
}

module.exports = {
  getCoberturaPadrao,
  __internals: {
    normalizarListaCobertura,
    normalizarUf,
    normalizarCidade
  }
};

