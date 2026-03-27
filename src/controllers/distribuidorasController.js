const distribuidorasService = require("../services/distribuidorasService");

function listarDistribuidoras(req, res) {
  try {
    const distribuidoras = distribuidorasService.listarDistribuidoras();
    return res.status(200).json(distribuidoras);
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: "Erro inesperado ao listar distribuidoras."
    });
  }
}

module.exports = {
  listarDistribuidoras
};
