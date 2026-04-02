const bandeiraService = require("../services/bandeiraService");

function obterBandeiraAtual(req, res, next) {
  try {
    const bandeira = bandeiraService.obterBandeiraAtual();
    return res.status(200).json(bandeira);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  obterBandeiraAtual
};
