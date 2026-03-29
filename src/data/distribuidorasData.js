const distribuidoras = require("./distribuidoras.json");

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

module.exports = {
  getDistribuidoras,
  getDistribuidoraById
};
