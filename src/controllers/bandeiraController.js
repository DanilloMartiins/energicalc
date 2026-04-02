const bandeiraService = require("../services/bandeiraService");
const { sendSuccess } = require("../utils/response");

function obterBandeiraAtual(req, res, next) {
  try {
    const bandeira = bandeiraService.obterBandeiraAtual();
    return sendSuccess(res, 200, bandeira);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obterBandeiraAtual
};
