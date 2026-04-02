const tarifasData = require("../data/tarifasData");

function listarTarifas() {
  return tarifasData.getTarifas();
}

module.exports = {
  listarTarifas
};
