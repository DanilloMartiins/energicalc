const tarifasData = require("../data/tarifasData");
const tarifasAneelData = require("../data/tarifasAneelData");
const distribuidorasService = require("./distribuidorasService");

function obterTarifaFallbackPorNome(nomeDistribuidora) {
  const nomeNormalizado = String(nomeDistribuidora || "").trim().toLowerCase();

  if (!nomeNormalizado) {
    return null;
  }

  const tarifasFallback = tarifasData.getTarifas();
  const tarifaEncontrada = tarifasFallback.find((item) => {
    return String(item.distribuidora || "").trim().toLowerCase() === nomeNormalizado;
  });

  if (!tarifaEncontrada) {
    return null;
  }

  return Number(tarifaEncontrada.tarifaKwh);
}

async function listarTarifas() {
  await sincronizarTarifasAneel();

  const distribuidoras = distribuidorasService.listarDistribuidoras();

  return distribuidoras.map((item) => {
    const tarifaVigente = obterTarifaVigentePorDistribuidora(item.codigo);
    const tarifaFallback = obterTarifaFallbackPorNome(item.nome);
    const tarifaKwh =
      tarifaVigente && Number.isFinite(tarifaVigente.tarifaKwh)
        ? tarifaVigente.tarifaKwh
        : Number.isFinite(tarifaFallback)
          ? tarifaFallback
          : 0.82;

    return {
      distribuidora: item.nome,
      tarifaKwh
    };
  });
}

async function sincronizarTarifasAneel(force = false) {
  return tarifasAneelData.syncTarifasAneel(force);
}

function obterTarifaVigentePorSigAgente(sigAgente) {
  return tarifasAneelData.getTarifaBySigAgente(sigAgente);
}

function obterTarifaVigentePorDistribuidora(distribuidoraIdOuCodigo) {
  const sigAgente = distribuidorasService.obterSigAgenteAneel(distribuidoraIdOuCodigo);

  if (!sigAgente) {
    return null;
  }

  return obterTarifaVigentePorSigAgente(sigAgente);
}

module.exports = {
  listarTarifas,
  sincronizarTarifasAneel,
  obterTarifaVigentePorSigAgente,
  obterTarifaVigentePorDistribuidora
};
