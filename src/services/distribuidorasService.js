const distribuidorasData = require("../data/distribuidorasData");

function listarDistribuidoras() {
  return distribuidorasData.getDistribuidoras();
}

module.exports = {
  listarDistribuidoras
};
