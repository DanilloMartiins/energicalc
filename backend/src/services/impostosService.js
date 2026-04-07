const impostosData = require("../data/impostosData");

function obterImpostos() {
  return impostosData.getImpostos();
}

module.exports = {
  obterImpostos
};
