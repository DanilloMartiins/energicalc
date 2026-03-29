const calculoService = require("../services/calculoService");

function respostaErro(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function calcular(req, res) {
  const {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId
  } = req.query;

  if (
    leituraAnterior === undefined ||
    leituraAtual === undefined ||
    diasDecorridos === undefined ||
    !distribuidoraId
  ) {
    return respostaErro(
      res,
      400,
      "Invalid input",
      "Informe leituraAnterior, leituraAtual, diasDecorridos e distribuidoraId."
    );
  }

  const leituraAnteriorNumero = Number(leituraAnterior);
  const leituraAtualNumero = Number(leituraAtual);
  const diasDecorridosNumero = Number(diasDecorridos);

  if (
    !Number.isFinite(leituraAnteriorNumero) ||
    !Number.isFinite(leituraAtualNumero) ||
    !Number.isFinite(diasDecorridosNumero)
  ) {
    return respostaErro(
      res,
      400,
      "Invalid input",
      "leituraAnterior, leituraAtual e diasDecorridos devem ser numericos."
    );
  }

  if (leituraAtualNumero < leituraAnteriorNumero) {
    return respostaErro(
      res,
      400,
      "Invalid input",
      "leituraAtual nao pode ser menor que leituraAnterior."
    );
  }

  if (diasDecorridosNumero <= 0) {
    return respostaErro(
      res,
      400,
      "Invalid input",
      "diasDecorridos deve ser maior que zero."
    );
  }

  try {
    const resultado = calculoService.calcular({
      leituraAnterior: leituraAnteriorNumero,
      leituraAtual: leituraAtualNumero,
      diasDecorridos: diasDecorridosNumero,
      distribuidoraId: String(distribuidoraId).trim()
    });

    if (!resultado) {
      return respostaErro(
        res,
        404,
        "Not found",
        "Distribuidora nao encontrada."
      );
    }

    return res.status(200).json(resultado);
  } catch (error) {
    if (error && (error.status === 400 || error.statusCode === 400)) {
      return respostaErro(res, 400, "Invalid input", error.message);
    }

    if (error && (error.status === 404 || error.statusCode === 404)) {
      return respostaErro(res, 404, "Not found", error.message);
    }

    return respostaErro(
      res,
      500,
      "Internal server error",
      "Erro inesperado ao calcular a fatura."
    );
  }
}

module.exports = {
  calcular
};
