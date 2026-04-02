const calculoService = require("../services/calculoService");
const distribuidorasService = require("../services/distribuidorasService");
const bandeiraService = require("../services/bandeiraService");

function respostaErro400(res, mensagem) {
  return res.status(400).json({ erro: mensagem });
}

function valorVazio(valor) {
  return valor === undefined || valor === null || String(valor).trim() === "";
}

function calcular(req, res) {
  const {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira
  } = req.query;

  if (
    valorVazio(leituraAnterior) ||
    valorVazio(leituraAtual) ||
    valorVazio(diasDecorridos) ||
    valorVazio(distribuidoraId) ||
    valorVazio(bandeira)
  ) {
    return respostaErro400(
      res,
      "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
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
    return respostaErro400(
      res,
      "leitura anterior, leitura atual e dias decorridos devem ser numeros validos."
    );
  }

  if (
    leituraAnteriorNumero <= 0 ||
    leituraAtualNumero <= 0 ||
    diasDecorridosNumero <= 0
  ) {
    return respostaErro400(
      res,
      "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero."
    );
  }

  if (leituraAtualNumero <= leituraAnteriorNumero) {
    return respostaErro400(res, "leitura atual deve ser maior que leitura anterior.");
  }

  const distribuidoraIdNormalizado = String(distribuidoraId).trim();
  const distribuidoraEncontrada =
    distribuidorasService.obterDistribuidoraPorId(distribuidoraIdNormalizado);

  if (!distribuidoraEncontrada) {
    return respostaErro400(res, "Distribuidora informada nao existe.");
  }

  const bandeiraNormalizada = String(bandeira).trim().toLowerCase();
  const bandeirasValidas = bandeiraService.listarTiposBandeira();

  if (!bandeirasValidas.includes(bandeiraNormalizada)) {
    return respostaErro400(
      res,
      `Bandeira invalida. Valores aceitos: ${bandeirasValidas.join(", ")}.`
    );
  }

  try {
    const resultado = calculoService.calcular({
      leituraAnterior: leituraAnteriorNumero,
      leituraAtual: leituraAtualNumero,
      diasDecorridos: diasDecorridosNumero,
      distribuidoraId: distribuidoraIdNormalizado
    });

    return res.status(200).json(resultado);
  } catch (error) {
    const status = error && (error.status || error.statusCode);

    if (status === 400 || status === 404) {
      return respostaErro400(res, error.message);
    }

    return res.status(500).json({ erro: "Erro inesperado ao calcular a fatura." });
  }
}

module.exports = {
  calcular
};
