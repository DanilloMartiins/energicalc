const { readJson } = require("../utils/readJson");

const impostos = readJson("data/impostos.json");

function getImpostos() {
  return impostos;
}

module.exports = {
  getImpostos
};
