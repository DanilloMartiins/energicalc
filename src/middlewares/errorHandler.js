const AppError = require("../utils/AppError");
const { sendError } = require("../utils/response");

function errorHandler(err, req, res, next) {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return sendError(res, 400, "JSON invalido no corpo da requisicao.");
  }

  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.message);
  }

  return sendError(res, 500, "Erro interno do servidor.");
}

module.exports = errorHandler;
