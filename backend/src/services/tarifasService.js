const tarifasData = require("../data/tarifasData");
const tarifasAneelData = require("../data/tarifasAneelData");
const distribuidorasService = require("./distribuidorasService");

function listarTarifas() {
  return tarifasData.getTarifas();
}

async function sincronizarTarifasAneel(force = false) {
  return tarifasAneelData.syncTarifasAneel(force);
}

function obterTarifaVigentePorSigAgente(sigAgente) {
  return tarifasAneelData.getTarifaBySigAgente(sigAgente);
}

function obterTarifaVigentePorDistribuidora(distribuidoraIdOuCodigo) {
  const sigAgente = distribuidorasService.obterSigAgenteAneel(distribuidoraIdOuCodigo);

  if (!sigAgente) {
    return null;
  }

  return obterTarifaVigentePorSigAgente(sigAgente);
}

module.exports = {
  listarTarifas,
  sincronizarTarifasAneel,
  obterTarifaVigentePorSigAgente,
  obterTarifaVigentePorDistribuidora
};
