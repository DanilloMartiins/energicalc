const distribuidorasData = require("../data/distribuidorasData");

function listarDistribuidoras() {
  return distribuidorasData.getDistribuidoras();
}

function obterDistribuidoraPorId(id) {
  return distribuidorasData.getDistribuidoraById(id);
}

module.exports = {
  listarDistribuidoras,
  obterDistribuidoraPorId
};
