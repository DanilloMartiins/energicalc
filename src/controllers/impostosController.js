const impostosService = require("../services/impostosService");
const { sendSuccess } = require("../utils/response");

function listarImpostos(req, res, next) {
  try {
    const impostos = impostosService.obterImpostos();
    return sendSuccess(res, 200, impostos);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarImpostos
};
