const calculoService = require("../services/calculoService");
const distribuidorasService = require("../services/distribuidorasService");
const bandeiraService = require("../services/bandeiraService");
const { hasRequiredFields } = require("../utils/validation");
const { toNumber, isValidNumber, isPositive } = require("../utils/number");
const { sendSuccess, sendError } = require("../utils/response");
const DIAS_PADRAO_POST = 30;

function respostaErro400(res, mensagem) {
  return sendError(res, 400, mensagem);
}

function bandeiraEhValida(bandeira) {
  const bandeiraNormalizada = String(bandeira).trim().toLowerCase();
  const bandeirasValidas = bandeiraService.listarTiposBandeira();

  return {
    valida: bandeirasValidas.includes(bandeiraNormalizada),
    bandeirasValidas
  };
}

async function calcular(req, res) {
  const {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira
  } = req.query;

  if (
    !hasRequiredFields([
      leituraAnterior,
      leituraAtual,
      diasDecorridos,
      distribuidoraId,
      bandeira
    ])
  ) {
    return respostaErro400(
      res,
      "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
    );
  }

  const leituraAnteriorNumero = toNumber(leituraAnterior);
  const leituraAtualNumero = toNumber(leituraAtual);
  const diasDecorridosNumero = toNumber(diasDecorridos);

  if (
    !isValidNumber(leituraAnteriorNumero) ||
    !isValidNumber(leituraAtualNumero) ||
    !isValidNumber(diasDecorridosNumero)
  ) {
    return respostaErro400(
      res,
      "leitura anterior, leitura atual e dias decorridos devem ser numeros validos."
    );
  }

  if (
    !isPositive(leituraAnteriorNumero) ||
    !isPositive(leituraAtualNumero) ||
    !isPositive(diasDecorridosNumero)
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
  const bandeiraNormalizada = String(bandeira).trim().toLowerCase();
  const distribuidoraEncontrada =
    distribuidorasService.obterDistribuidoraPorId(distribuidoraIdNormalizado);

  if (!distribuidoraEncontrada) {
    return respostaErro400(res, "Distribuidora informada nao existe.");
  }

  const validacaoBandeira = bandeiraEhValida(bandeira);

  if (!validacaoBandeira.valida) {
    return respostaErro400(
      res,
      `Bandeira invalida. Valores aceitos: ${validacaoBandeira.bandeirasValidas.join(", ")}.`
    );
  }

  try {
    const resultado = calculoService.calcular({
      leituraAnterior: leituraAnteriorNumero,
      leituraAtual: leituraAtualNumero,
      diasDecorridos: diasDecorridosNumero,
      distribuidoraId: distribuidoraIdNormalizado,
      bandeira: bandeiraNormalizada
    });

    return sendSuccess(res, 200, resultado);
  } catch (error) {
    const status = error && (error.status || error.statusCode);

    if (status === 400 || status === 404) {
      return respostaErro400(res, error.message);
    }

    return sendError(res, 500, "Erro inesperado ao calcular a fatura.");
  }
}

async function calcularPost(req, res) {
  const { consumo, distribuidora, bandeira } = req.body || {};

  if (!hasRequiredFields([consumo, distribuidora, bandeira])) {
    return respostaErro400(res, "Informe consumo, nome da distribuidora e bandeira.");
  }

  const consumoNumero = toNumber(consumo);
  const bandeiraNormalizada = String(bandeira).trim().toLowerCase();

  if (!isValidNumber(consumoNumero)) {
    return respostaErro400(res, "consumo deve ser um numero valido.");
  }

  if (!isPositive(consumoNumero)) {
    return respostaErro400(res, "consumo deve ser maior que zero.");
  }

  const distribuidoraNormalizada = String(distribuidora).trim();
  const distribuidoraEncontrada =
    distribuidorasService.obterDistribuidoraPorNome(distribuidoraNormalizada);

  if (!distribuidoraEncontrada) {
    return respostaErro400(res, "Distribuidora informada nao existe.");
  }

  const validacaoBandeira = bandeiraEhValida(bandeira);

  if (!validacaoBandeira.valida) {
    return respostaErro400(
      res,
      `Bandeira invalida. Valores aceitos: ${validacaoBandeira.bandeirasValidas.join(", ")}.`
    );
  }

  try {
    // O service atual trabalha com leituraAnterior, leituraAtual e diasDecorridos.
    // No POST, como recebemos apenas o consumo, fazemos uma adaptacao simples:
    // leituraAnterior = 0, leituraAtual = consumo e diasDecorridos = 30.
    // Futuramente, este mapeamento pode ser evoluido conforme novas regras do negocio.
    const resultado = calculoService.calcular({
      leituraAnterior: 0,
      leituraAtual: consumoNumero,
      diasDecorridos: DIAS_PADRAO_POST,
      distribuidoraId: distribuidoraEncontrada.codigo,
      bandeira: bandeiraNormalizada
    });

    return sendSuccess(res, 200, resultado);
  } catch (error) {
    const status = error && (error.status || error.statusCode);

    if (status === 400 || status === 404) {
      return respostaErro400(res, error.message);
    }

    return sendError(res, 500, "Erro inesperado ao calcular a fatura.");
  }
}

module.exports = {
  calcular,
  calcularPost
};
