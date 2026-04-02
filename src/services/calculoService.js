const distribuidorasData = require("../data/distribuidorasData");
const bandeiraData = require("../data/bandeiraData");

function criarErro(status, error, message) {
  const erro = new Error(message);
  erro.status = status;
  erro.error = error;
  return erro;
}

function arredondar(valor) {
  return Number(valor.toFixed(2));
}

function valorAusente(valor) {
  return (
    valor === undefined ||
    valor === null ||
    (typeof valor === "string" && valor.trim() === "")
  );
}

function normalizarParametros(
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId
) {
  if (typeof leituraAnterior === "object" && leituraAnterior !== null) {
    return {
      leituraAnterior: leituraAnterior.leituraAnterior,
      leituraAtual: leituraAnterior.leituraAtual,
      diasDecorridos: leituraAnterior.diasDecorridos,
      distribuidoraId: leituraAnterior.distribuidoraId
    };
  }

  return {
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId
  };
}

function validarEntradas({
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId
}) {
  if (
    valorAusente(leituraAnterior) ||
    valorAusente(leituraAtual) ||
    valorAusente(diasDecorridos) ||
    valorAusente(distribuidoraId)
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
    );
  }

  const leituraAnteriorNumero = Number(leituraAnterior);
  const leituraAtualNumero = Number(leituraAtual);
  const diasDecorridosNumero = Number(diasDecorridos);
  const distribuidoraIdNormalizado = String(distribuidoraId).trim();

  if (
    !Number.isFinite(leituraAnteriorNumero) ||
    !Number.isFinite(leituraAtualNumero) ||
    !Number.isFinite(diasDecorridosNumero)
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

  if (diasDecorridosNumero <= 0) {
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
  const tarifa = Number(distribuidora.tarifa ?? distribuidora.tarifaBaseKwh ?? 0.82);

  if (!Number.isFinite(tarifa) || tarifa < 0) {
    throw criarErro(
      500,
      "Internal server error",
      "Tarifa da distribuidora invalida nos dados."
    );
  }

  return tarifa;
}

function obterBandeiraVigente() {
  const bandeiraAtual = bandeiraData.getBandeiraAtual();
  const tipo = bandeiraAtual.vigente;
  const valor = Number((bandeiraAtual.valoresKwh || {})[tipo]);

  if (!tipo || !Number.isFinite(valor)) {
    throw criarErro(
      500,
      "Internal server error",
      "Bandeira tarifaria invalida nos dados."
    );
  }

  return { tipo, valor };
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

function calcularBandeira(consumoKwh) {
  const bandeira = obterBandeiraVigente();
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

function calcular(leituraAnterior, leituraAtual, diasDecorridos, distribuidoraId) {
  const params = normalizarParametros(
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId
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
  const bandeira = calcularBandeira(consumoKwh);
  const subtotal = calcularSubtotal(valorEnergia, bandeira.valor);
  const icms = calcularIcms(subtotal);
  const cip = calcularCip(distribuidora);
  const total = calcularTotal(subtotal, icms, cip);

  return montarResposta({
    distribuidora,
    consumoKwh,
    mediaDiaria,
    diasDecorridos: entradasValidadas.diasDecorridos,
    valorEnergia,
    bandeira,
    icms,
    cip,
    total
  });
}

module.exports = {
  calcular
};
