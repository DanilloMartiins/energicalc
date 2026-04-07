const bandeiraData = require("../data/bandeiraData");

function obterBandeiraAtual() {
  return bandeiraData.getBandeiraAtual();
}

async function sincronizarBandeiraAtual(force = false) {
  return bandeiraData.syncBandeiraAtual(force);
}

function listarTiposBandeira() {
  const bandeira = bandeiraData.getBandeiraAtual();
  const valores = bandeira.valoresKwh || {};
  return Object.keys(valores);
}

function obterAdicionalPorKwh(tipoBandeira) {
  const bandeira = bandeiraData.getBandeiraAtual();
  const valores = bandeira.valoresKwh || {};
  if (!Object.prototype.hasOwnProperty.call(valores, tipoBandeira)) {
    return null;
  }

  return valores[tipoBandeira];
}

module.exports = {
  obterBandeiraAtual,
  sincronizarBandeiraAtual,
  listarTiposBandeira,
  obterAdicionalPorKwh
};
