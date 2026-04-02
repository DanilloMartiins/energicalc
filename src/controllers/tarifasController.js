const tarifasService = require("../services/tarifasService");
const { sendSuccess } = require("../utils/response");

function listarTarifas(req, res, next) {
  try {
    const tarifas = tarifasService.listarTarifas();
    return sendSuccess(res, 200, tarifas);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarTarifas
};
