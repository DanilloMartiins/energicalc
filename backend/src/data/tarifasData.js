const { readJson } = require("../utils/readJson");

const tarifas = readJson("data/tarifas.json");

function getTarifas() {
  return tarifas;
}

module.exports = {
  getTarifas
};
