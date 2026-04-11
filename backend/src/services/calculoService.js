const distribuidorasData = require("../data/distribuidorasData");
const bandeiraData = require("../data/bandeiraData");
const tarifasService = require("./tarifasService");
const { hasRequiredFields } = require("../utils/validation");
const { toNumber, isValidNumber, isPositive } = require("../utils/number");

function criarErro(status, error, message) {
  const erro = new Error(message);
  erro.status = status;
  erro.error = error;
  return erro;
}

function arredondar(valor) {
  return Number(valor.toFixed(2));
}

function normalizarParametros(
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId,
  bandeira
) {
  if (typeof leituraAnterior === "object" && leituraAnterior !== null) {
    return {
      leituraAnterior: leituraAnterior.leituraAnterior,
      leituraAtual: leituraAnterior.leituraAtual,
      diasDecorridos: leituraAnterior.diasDecorridos,
      distribuidoraId: leituraAnterior.distribuidoraId,
      bandeira: leituraAnterior.bandeira
    };
  }

  return {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira
  };
}

function validarEntradas({
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId
}) {
  if (
    !hasRequiredFields([
      leituraAnterior,
      leituraAtual,
      diasDecorridos,
      distribuidoraId
    ])
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
    );
  }

  const leituraAnteriorNumero = toNumber(leituraAnterior);
  const leituraAtualNumero = toNumber(leituraAtual);
  const diasDecorridosNumero = toNumber(diasDecorridos);
  const distribuidoraIdNormalizado = String(distribuidoraId).trim();

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
    throw criarErro(
      400,
      "Invalid input",
      "leitura atual deve ser maior que leitura anterior."
    );
  }

  if (!isPositive(diasDecorridosNumero)) {
    throw criarErro(
      400,
      "Invalid input",
      "dias decorridos deve ser maior que zero."
    );
  }

  return {
    leituraAnterior: leituraAnteriorNumero,
    leituraAtual: leituraAtualNumero,
    diasDecorridos: diasDecorridosNumero,
    distribuidoraId: distribuidoraIdNormalizado
  };
}

function obterDistribuidora(distribuidoraId) {
  const distribuidora = distribuidorasData.getDistribuidoraById(distribuidoraId);

  if (!distribuidora) {
    throw criarErro(404, "Not found", "Distribuidora nao encontrada.");
  }

  return distribuidora;
}

function obterTarifaDistribuidora(distribuidora) {
  const tarifaVigente = tarifasService.obterTarifaVigentePorDistribuidora(
    distribuidora.codigo
  );
  const tarifaDinamica = tarifaVigente && tarifaVigente.tarifaKwh;
  const tarifa = toNumber(
    tarifaDinamica ?? distribuidora.tarifa ?? distribuidora.tarifaBaseKwh ?? 0.82
  );

  if (!isValidNumber(tarifa) || tarifa < 0) {
    throw criarErro(
      500,
      "Internal server error",
      "Tarifa da distribuidora invalida nos dados."
    );
  }

  return tarifa;
}

function obterBandeiraSelecionada(tipoInformado) {
  const bandeiraAtual = bandeiraData.getBandeiraAtual();
  const valoresKwh = bandeiraAtual.valoresKwh || {};
  const tipoNormalizado = String(tipoInformado || "").trim().toLowerCase();
  const tipoSelecionado = tipoNormalizado || bandeiraAtual.vigente;

  if (
    tipoNormalizado &&
    !Object.prototype.hasOwnProperty.call(valoresKwh, tipoNormalizado)
  ) {
    throw criarErro(400, "Invalid input", "Bandeira informada nao existe.");
  }

  const valor = toNumber(valoresKwh[tipoSelecionado]);

  if (!tipoSelecionado || !isValidNumber(valor)) {
    throw criarErro(
      500,
      "Internal server error",
      "Bandeira tarifaria invalida nos dados."
    );
  }

  return { tipo: tipoSelecionado, valor };
}

function calcularConsumo(leituraAnterior, leituraAtual) {
  return leituraAtual - leituraAnterior;
}

function calcularMediaDiaria(consumoKwh, diasDecorridos) {
  return arredondar(consumoKwh / diasDecorridos);
}

function calcularValorEnergia(consumoKwh, distribuidora) {
  const tarifa = obterTarifaDistribuidora(distribuidora);
  return arredondar(consumoKwh * tarifa);
}

function calcularBandeira(consumoKwh, tipoBandeira) {
  const bandeira = obterBandeiraSelecionada(tipoBandeira);
  const valor = arredondar(consumoKwh * bandeira.valor);

  return {
    tipo: bandeira.tipo,
    valor
  };
}

function calcularSubtotal(valorEnergia, valorBandeira) {
  return arredondar(valorEnergia + valorBandeira);
}

function calcularIcms(subtotal) {
  return arredondar(subtotal * 0.25);
}

function calcularCip(distribuidora) {
  return arredondar(Number(distribuidora.cip || 0));
}

function calcularTotal(subtotal, icms, cip) {
  return arredondar(subtotal + icms + cip);
}

function montarResposta({
  distribuidora,
  consumoKwh,
  mediaDiaria,
  diasDecorridos,
  valorEnergia,
  bandeira,
  icms,
  cip,
  total
}) {
  return {
    distribuidora: distribuidora.nome,
    consumoKwh,
    mediaDiaria,
    diasDecorridos,
    valorEnergia,
    bandeira,
    icms,
    cip,
    total
  };
}

function calcular(
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId,
  bandeira
) {
  const params = normalizarParametros(
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId,
    bandeira
  );

  const entradasValidadas = validarEntradas({
    leituraAnterior: params.leituraAnterior,
    leituraAtual: params.leituraAtual,
    diasDecorridos: params.diasDecorridos,
    distribuidoraId: params.distribuidoraId
  });

  const distribuidora = obterDistribuidora(entradasValidadas.distribuidoraId);

  const consumoKwh = calcularConsumo(entradasValidadas.leituraAnterior, entradasValidadas.leituraAtual);
  const mediaDiaria = calcularMediaDiaria(consumoKwh, entradasValidadas.diasDecorridos);
  const valorEnergia = calcularValorEnergia(consumoKwh, distribuidora);
  const bandeiraCalculada = calcularBandeira(consumoKwh, params.bandeira);
  const subtotal = calcularSubtotal(valorEnergia, bandeiraCalculada.valor);
  const icms = calcularIcms(subtotal);
  const cip = calcularCip(distribuidora);
  const total = calcularTotal(subtotal, icms, cip);

  return montarResposta({
    distribuidora,
    consumoKwh,
    mediaDiaria,
    diasDecorridos: entradasValidadas.diasDecorridos,
    valorEnergia,
    bandeira: bandeiraCalculada,
    icms,
    cip,
    total
  });
}

module.exports = {
  calcular
};
