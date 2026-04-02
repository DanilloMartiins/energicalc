const { readJson } = require("../utils/readJson");

const bandeira = readJson("data/bandeira.json");

function getBandeiraAtual() {
  return bandeira;
}

module.exports = {
  getBandeiraAtual
};
