const cobertura = require("./distribuidorasCobertura.json");
const { normalizarMunicipio, normalizarUf } = require("./cipData");

function montarChave(cidade, uf) {
  return `${normalizarUf(uf)}|${normalizarMunicipio(cidade)}`;
}

function construirIndiceIbge() {
  const indice = new Map();

  (Array.isArray(cobertura) ? cobertura : []).forEach((item) => {
    const cidade = String(item && item.cidade ? item.cidade : "").trim();
    const uf = String(item && item.uf ? item.uf : "").trim();
    const codMunicipio = String(item && item.codMunicipio ? item.codMunicipio : "")
      .trim()
      .replace(/\D/g, "");

    if (!cidade || !uf || !codMunicipio) {
      return;
    }

    const chave = montarChave(cidade, uf);
    if (!indice.has(chave)) {
      indice.set(chave, codMunicipio);
    }
  });

  return indice;
}

const indiceIbge = construirIndiceIbge();

function resolverCodigoMunicipioIbge(cidade, uf) {
  if (!cidade || !uf) {
    return "";
  }

  const chave = montarChave(cidade, uf);
  return indiceIbge.get(chave) || "";
}

module.exports = {
  resolverCodigoMunicipioIbge
};
