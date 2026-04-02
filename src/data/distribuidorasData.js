const { readJson } = require("../utils/readJson");

const distribuidoras = readJson("data/distribuidoras.json");

function getDistribuidoras() {
  return distribuidoras;
}

function getDistribuidoraById(id) {
  const idInformado = String(id).trim();

  return distribuidoras.find((item, index) => {
    const idNumerico = String(index + 1);
    return idInformado === idNumerico || idInformado === String(item.codigo);
  }) || null;
}

function getDistribuidoraByNome(nome) {
  const nomeInformado = String(nome || "").trim().toLowerCase();

  if (!nomeInformado) {
    return null;
  }

  return distribuidoras.find((item) => {
    return String(item.nome || "").trim().toLowerCase() === nomeInformado;
  }) || null;
}

module.exports = {
  getDistribuidoras,
  getDistribuidoraById,
  getDistribuidoraByNome
};
