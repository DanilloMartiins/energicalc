const cipService = require("../services/cipService");
const { sendError, sendSuccess } = require("../utils/response");

function obterCipPorCidade(req, res, next) {
  try {
    const cidade = String(req.query.cidade || "").trim();
    const uf = String(req.query.uf || "")
      .trim()
      .toUpperCase();

    if (!cidade || uf.length !== 2) {
      return sendError(res, 400, "Informe cidade e UF valida para consultar a CIP.");
    }

    const resultado = cipService.getCipPorCidade(cidade, uf);
    return sendSuccess(res, 200, resultado);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obterCipPorCidade
};
