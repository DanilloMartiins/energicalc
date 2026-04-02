const AppError = require("../utils/AppError");

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ erro: "JSON invalido no corpo da requisicao." });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ erro: err.message });
  }

  return res.status(500).json({ erro: "Erro interno do servidor." });
}

module.exports = errorHandler;
