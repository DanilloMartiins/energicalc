const bandeiraService = require("../services/bandeiraService");

function obterBandeiraAtual(req, res) {
  try {
    const bandeira = bandeiraService.obterBandeiraAtual();
    return res.status(200).json(bandeira);
  } catch (error) {
    return res.status(500).json({
      error: "Internal server error",
      message: "Erro inesperado ao buscar a bandeira tarifaria."
    });
  }
}

module.exports = {
  obterBandeiraAtual
};
