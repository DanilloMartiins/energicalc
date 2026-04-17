const distribuidorasService = require("./distribuidorasService");
const billingService = require("./billingService");
const bandeiraData = require("../data/bandeiraData");
const { hasRequiredFields } = require("../utils/validation");
const { toNumber, isValidNumber, isPositive } = require("../utils/number");

function criarErro(status, error, message) {
  const erro = new Error(message);
  erro.status = status;
  erro.error = error;
  return erro;
}

function normalizarParametros(
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId,
  bandeira,
  cidade,
  uf
) {
  if (typeof leituraAnterior === "object" && leituraAnterior !== null) {
    return {
      leituraAnterior: leituraAnterior.leituraAnterior,
      leituraAtual: leituraAnterior.leituraAtual,
      diasDecorridos: leituraAnterior.diasDecorridos,
      distribuidoraId: leituraAnterior.distribuidoraId,
      bandeira: leituraAnterior.bandeira,
      cidade: leituraAnterior.cidade,
      uf: leituraAnterior.uf
    };
  }

  return {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira,
    cidade,
    uf
  };
}

function validarBandeiraInformada(bandeiraInformada) {
  const bandeiraAtual = bandeiraData.getBandeiraAtual();
  const valoresKwh = bandeiraAtual.valoresKwh || {};
  const bandeiraNormalizada = String(bandeiraInformada || "").trim().toLowerCase();

  if (!bandeiraNormalizada) {
    return;
  }

  if (!Object.prototype.hasOwnProperty.call(valoresKwh, bandeiraNormalizada)) {
    throw criarErro(400, "Invalid input", "Bandeira informada nao existe.");
  }
}

function validarEntradas(params) {
  const leituraAnteriorNumero = toNumber(params.leituraAnterior);
  const leituraAtualNumero = toNumber(params.leituraAtual);
  const diasDecorridosNumero = toNumber(params.diasDecorridos);
  const distribuidoraIdNormalizado = String(params.distribuidoraId || "").trim();
  const cidadeNormalizada = String(params.cidade || "").trim();
  const ufNormalizada = String(params.uf || "")
    .trim()
    .toUpperCase();

  const usaDistribuidoraId = Boolean(distribuidoraIdNormalizado);
  const usaCidadeUf = Boolean(cidadeNormalizada && ufNormalizada);

  if (
    !hasRequiredFields([leituraAnteriorNumero, leituraAtualNumero, diasDecorridosNumero]) ||
    (!usaDistribuidoraId && !usaCidadeUf)
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "Informe leitura anterior, leitura atual, dias decorridos e distribuidoraId ou cidade+uf."
    );
  }

  if (
    !isValidNumber(leituraAnteriorNumero) ||
    !isValidNumber(leituraAtualNumero) ||
    !isValidNumber(diasDecorridosNumero)
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "leitura anterior, leitura atual e dias decorridos devem ser numericos."
    );
  }

  if (leituraAtualNumero <= leituraAnteriorNumero) {
    throw criarErro(400, "Invalid input", "leitura atual deve ser maior que leitura anterior.");
  }

  if (!isPositive(diasDecorridosNumero)) {
    throw criarErro(400, "Invalid input", "dias decorridos deve ser maior que zero.");
  }

  validarBandeiraInformada(params.bandeira);

  return {
    leituraAnterior: leituraAnteriorNumero,
    leituraAtual: leituraAtualNumero,
    diasDecorridos: diasDecorridosNumero,
    distribuidoraId: distribuidoraIdNormalizado,
    bandeira: String(params.bandeira || "").trim().toLowerCase(),
    cidade: cidadeNormalizada,
    uf: ufNormalizada
  };
}

function obterDistribuidora({ distribuidoraId, cidade, uf }) {
  if (distribuidoraId) {
    const porId = distribuidorasService.obterDistribuidoraPorId(distribuidoraId);
    if (porId) {
      return porId;
    }
  }

  if (cidade && uf) {
    const porCidadeUf = distribuidorasService.obterDistribuidoraPorCidadeUf(cidade, uf);
    if (porCidadeUf) {
      return porCidadeUf;
    }
  }

  throw criarErro(404, "Not found", "Distribuidora nao encontrada.");
}

function calcular(
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId,
  bandeira,
  cidade,
  uf
) {
  const params = normalizarParametros(
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira,
    cidade,
    uf
  );
  const entradasValidadas = validarEntradas(params);
  const distribuidora = obterDistribuidora(entradasValidadas);

  return billingService.calcularFatura({
    leituraAnterior: entradasValidadas.leituraAnterior,
    leituraAtual: entradasValidadas.leituraAtual,
    diasDecorridos: entradasValidadas.diasDecorridos,
    bandeira: entradasValidadas.bandeira,
    cidade: entradasValidadas.cidade,
    uf: entradasValidadas.uf || distribuidora.uf,
    distribuidora
  });
}

module.exports = {
  calcular
};
