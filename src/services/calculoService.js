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

function validarEntrada({
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId
}) {
  if (
    leituraAnterior === undefined ||
    leituraAtual === undefined ||
    diasDecorridos === undefined ||
    distribuidoraId === undefined ||
    String(distribuidoraId).trim() === ""
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "Informe leituraAnterior, leituraAtual, diasDecorridos e distribuidoraId."
    );
  }

  if (
    !Number.isFinite(leituraAnterior) ||
    !Number.isFinite(leituraAtual) ||
    !Number.isFinite(diasDecorridos)
  ) {
    throw criarErro(
      400,
      "Invalid input",
      "leituraAnterior, leituraAtual e diasDecorridos devem ser numericos."
    );
  }

  if (leituraAtual <= leituraAnterior) {
    throw criarErro(
      400,
      "Invalid input",
      "leituraAtual deve ser maior que leituraAnterior."
    );
  }

  if (diasDecorridos <= 0) {
    throw criarErro(
      400,
      "Invalid input",
      "diasDecorridos deve ser maior que zero."
    );
  }
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

function calcular({
  leituraAnterior,
  leituraAtual,
  diasDecorridos,
  distribuidoraId
}) {
  validarEntrada({
    leituraAnterior,
    leituraAtual,
    diasDecorridos,
    distribuidoraId
  });

  const distribuidora = distribuidorasData.getDistribuidoraById(distribuidoraId);
  if (!distribuidora) {
    throw criarErro(404, "Not found", "Distribuidora nao encontrada.");
  }

  const consumoKwh = leituraAtual - leituraAnterior;
  const mediaDiaria = arredondar(consumoKwh / diasDecorridos);

  const tarifa = obterTarifaDistribuidora(distribuidora);
  const valorEnergia = arredondar(consumoKwh * tarifa);

  const bandeira = obterBandeiraVigente();
  const bandeiraValor = arredondar(consumoKwh * bandeira.valor);

  const subtotal = arredondar(valorEnergia + bandeiraValor);
  const icms = arredondar(subtotal * 0.25);
  const cip = arredondar(Number(distribuidora.cip || 0));
  const total = arredondar(subtotal + icms + cip);

  return {
    distribuidora: distribuidora.nome,
    consumoKwh,
    mediaDiaria,
    diasDecorridos,
    valorEnergia,
    bandeira: {
      tipo: bandeira.tipo,
      valor: bandeiraValor
    },
    icms,
    cip,
    total
  };
}

module.exports = {
  calcular
};
