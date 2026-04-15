const distribuidorasAneelData = require("./distribuidorasAneelData");

function getDistribuidoras() {
  return distribuidorasAneelData.getDistribuidorasCache();
}

function getDistribuidoraById(id) {
  const idInformado = String(id).trim();
  const distribuidoras = getDistribuidoras();

  return distribuidoras.find((item, index) => {
    const idNumerico = String(index + 1);
    return idInformado === idNumerico || idInformado === String(item.codigo);
  }) || null;
}

function getDistribuidoraByNome(nome) {
  const nomeInformado = String(nome || "").trim().toLowerCase();
  const distribuidoras = getDistribuidoras();

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
  getDistribuidoraByNome,
  syncDistribuidorasAneel: distribuidorasAneelData.syncDistribuidorasAneel
};
