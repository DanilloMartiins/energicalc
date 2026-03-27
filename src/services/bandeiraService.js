const bandeira = require("../data/bandeira.json");

function obterBandeiraAtual() {
  return bandeira;
}

function listarTiposBandeira() {
  const valores = bandeira.valoresKwh || {};
  return Object.keys(valores);
}

function obterAdicionalPorKwh(tipoBandeira) {
  const valores = bandeira.valoresKwh || {};
  if (!Object.prototype.hasOwnProperty.call(valores, tipoBandeira)) {
    return null;
  }

  return valores[tipoBandeira];
}

module.exports = {
  obterBandeiraAtual,
  listarTiposBandeira,
  obterAdicionalPorKwh
};
