const bandeiraService = require("./bandeiraService");

function simularCalculo({ consumoKwh, tarifaBase, bandeira }) {
  const consumo = consumoKwh;
  const tarifa = tarifaBase;

  const adicionalBandeira = bandeiraService.obterAdicionalPorKwh(bandeira);
  const valorSemBandeira = Number((consumo * tarifa).toFixed(2));
  const valorAdicionalBandeira = Number((consumo * adicionalBandeira).toFixed(2));
  const valorTotalEstimado = Number((valorSemBandeira + valorAdicionalBandeira).toFixed(2));

  return {
    consumoKwh: consumo,
    tarifaBase: tarifa,
    bandeira,
    adicionalBandeira,
    valorSemBandeira,
    valorAdicionalBandeira,
    valorTotalEstimado
  };
}

module.exports = {
  simularCalculo
};
