const fs = require("fs");
const path = require("path");
const { readJson } = require("../utils/readJson");

const TARIFAS_FILE_PATH = path.resolve(__dirname, "tarifas.json");
const FALLBACK_TARIFAS = readJson("data/tarifas.json");

function getTarifas() {
  try {
    const conteudo = fs.readFileSync(TARIFAS_FILE_PATH, "utf-8");
    const tarifas = JSON.parse(conteudo);
    return Array.isArray(tarifas) ? tarifas : FALLBACK_TARIFAS;
  } catch (error) {
    return FALLBACK_TARIFAS;
  }
}

module.exports = {
  getTarifas
};
