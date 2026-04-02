const distribuidorasService = require("../services/distribuidorasService");

function listarDistribuidoras(req, res, next) {
  try {
    const distribuidoras = distribuidorasService.listarDistribuidoras();
    return res.status(200).json(distribuidoras);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarDistribuidoras
};
