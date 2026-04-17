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
  const bandeiraNormalizada = String(bandeira || "").trim().toLowerCase();
  const bandeirasValidas = bandeiraService.listarTiposBandeira();

  return {
    valida: bandeirasValidas.includes(bandeiraNormalizada),
    bandeirasValidas
  };
}

function validarLeiturasGet(leituraAnterior, leituraAtual, diasDecorridos) {
  if (!hasRequiredFields([leituraAnterior, leituraAtual, diasDecorridos])) {
    return "Informe leitura anterior, leitura atual e dias decorridos.";
  }

  const leituraAnteriorNumero = toNumber(leituraAnterior);
  const leituraAtualNumero = toNumber(leituraAtual);
  const diasDecorridosNumero = toNumber(diasDecorridos);

  if (
    !isValidNumber(leituraAnteriorNumero) ||
    !isValidNumber(leituraAtualNumero) ||
    !isValidNumber(diasDecorridosNumero)
  ) {
    return "leitura anterior, leitura atual e dias decorridos devem ser numeros validos.";
  }

  if (
    !isPositive(leituraAnteriorNumero) ||
    !isPositive(leituraAtualNumero) ||
    !isPositive(diasDecorridosNumero)
  ) {
    return "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero.";
  }

  if (leituraAtualNumero <= leituraAnteriorNumero) {
    return "leitura atual deve ser maior que leitura anterior.";
  }

  return "";
}

function validarOrigemDistribuidora(distribuidoraId, cidade, uf) {
  const idNormalizado = String(distribuidoraId || "").trim();
  const cidadeNormalizada = String(cidade || "").trim();
  const ufNormalizada = String(uf || "")
    .trim()
    .toUpperCase();

  const usaId = Boolean(idNormalizado);
  const usaCidadeUf = Boolean(cidadeNormalizada && ufNormalizada);

  if (!usaId && !usaCidadeUf) {
    return {
      valido: false,
      mensagem: "Informe distribuidoraId ou cidade+uf para calcular."
    };
  }

  if (usaId) {
    const distribuidora = distribuidorasService.obterDistribuidoraPorId(idNormalizado);

    if (!distribuidora) {
      return {
        valido: false,
        mensagem: "Distribuidora informada nao existe."
      };
    }
  }

  if (usaCidadeUf && ufNormalizada.length !== 2) {
    return {
      valido: false,
      mensagem: "uf deve ter 2 caracteres."
    };
  }

  return { valido: true };
}

async function calcular(req, res) {
  const { leituraAnterior, leituraAtual, diasDecorridos, distribuidoraId, bandeira, cidade, uf } =
    req.query;

  const erroLeituras = validarLeiturasGet(leituraAnterior, leituraAtual, diasDecorridos);
  if (erroLeituras) {
    return respostaErro400(res, erroLeituras);
  }

  if (!hasRequiredFields([bandeira])) {
    return respostaErro400(res, "Informe bandeira para calcular.");
  }

  const validacaoOrigem = validarOrigemDistribuidora(distribuidoraId, cidade, uf);
  if (!validacaoOrigem.valido) {
    return respostaErro400(res, validacaoOrigem.mensagem);
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
      leituraAnterior: toNumber(leituraAnterior),
      leituraAtual: toNumber(leituraAtual),
      diasDecorridos: toNumber(diasDecorridos),
      distribuidoraId: String(distribuidoraId || "").trim(),
      bandeira: String(bandeira || "").trim().toLowerCase(),
      cidade: String(cidade || "").trim(),
      uf: String(uf || "")
        .trim()
        .toUpperCase()
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
  const { consumo, distribuidora, bandeira, cidade, uf } = req.body || {};

  if (!hasRequiredFields([consumo, bandeira])) {
    return respostaErro400(
      res,
      "Informe consumo e bandeira. Distribuidora pode ser informada por nome ou cidade+uf."
    );
  }

  const consumoNumero = toNumber(consumo);
  if (!isValidNumber(consumoNumero)) {
    return respostaErro400(res, "consumo deve ser um numero valido.");
  }

  if (!isPositive(consumoNumero)) {
    return respostaErro400(res, "consumo deve ser maior que zero.");
  }

  const validacaoBandeira = bandeiraEhValida(bandeira);
  if (!validacaoBandeira.valida) {
    return respostaErro400(
      res,
      `Bandeira invalida. Valores aceitos: ${validacaoBandeira.bandeirasValidas.join(", ")}.`
    );
  }

  const distribuidoraPorNome = String(distribuidora || "").trim()
    ? distribuidorasService.obterDistribuidoraPorNome(String(distribuidora).trim())
    : null;
  const distribuidoraPorCidadeUf =
    String(cidade || "").trim() && String(uf || "").trim()
      ? distribuidorasService.obterDistribuidoraPorCidadeUf(
          String(cidade).trim(),
          String(uf).trim().toUpperCase()
        )
      : null;
  const distribuidoraResolvida = distribuidoraPorNome || distribuidoraPorCidadeUf;

  if (!distribuidoraResolvida) {
    return respostaErro400(res, "Distribuidora informada nao existe.");
  }

  try {
    const resultado = calculoService.calcular({
      leituraAnterior: 0,
      leituraAtual: consumoNumero,
      diasDecorridos: DIAS_PADRAO_POST,
      distribuidoraId: distribuidoraResolvida.codigo,
      bandeira: String(bandeira).trim().toLowerCase(),
      cidade: String(cidade || "").trim(),
      uf: String(uf || "")
        .trim()
        .toUpperCase()
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
