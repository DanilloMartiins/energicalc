const fs = require("fs");
const path = require("path");
const tarifasData = require("../data/tarifasData");
const tarifasAneelData = require("../data/tarifasAneelData");
const distribuidorasService = require("./distribuidorasService");

const TARIFAS_FALLBACK_FILE_PATH = process.env.TARIFAS_FALLBACK_FILE_PATH
  ? path.resolve(process.env.TARIFAS_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "../data/tarifas.json");
let ultimoMesSincronizado = identificarMesSincronizadoInicial();
let ultimoDiaTentativaSemSucesso = "";

function obterChaveMes(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function obterChaveDia(data = new Date()) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function identificarMesSincronizadoInicial() {
  try {
    const stats = fs.statSync(TARIFAS_FALLBACK_FILE_PATH);
    return obterChaveMes(new Date(stats.mtimeMs));
  } catch (error) {
    return "";
  }
}

function obterTarifaFallbackDetalhadaPorNome(nomeDistribuidora) {
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

  return {
    tarifaKwh: Number(tarifaEncontrada.tarifaKwh),
    teKwh:
      tarifaEncontrada.teKwh === null || tarifaEncontrada.teKwh === undefined
        ? null
        : Number.isFinite(Number(tarifaEncontrada.teKwh))
          ? Number(tarifaEncontrada.teKwh)
          : null,
    tusdKwh:
      tarifaEncontrada.tusdKwh === null || tarifaEncontrada.tusdKwh === undefined
        ? null
        : Number.isFinite(Number(tarifaEncontrada.tusdKwh))
          ? Number(tarifaEncontrada.tusdKwh)
          : null,
    fonte: "fallback_local"
  };
}

async function listarTarifas() {
  const distribuidoras = distribuidorasService.listarDistribuidoras();

  return distribuidoras.map((item) => {
    const tarifaVigente = obterTarifaVigentePorDistribuidora(item.codigo);
    const tarifaFallback = obterTarifaFallbackDetalhadaPorNome(item.nome);
    const tarifaKwh =
      tarifaVigente && Number.isFinite(tarifaVigente.tarifaKwh)
        ? tarifaVigente.tarifaKwh
        : tarifaFallback && Number.isFinite(tarifaFallback.tarifaKwh)
          ? tarifaFallback.tarifaKwh
          : 0.82;
    const teKwh =
      tarifaVigente && Number.isFinite(tarifaVigente.teKwh)
        ? tarifaVigente.teKwh
        : tarifaFallback && Number.isFinite(tarifaFallback.teKwh)
          ? tarifaFallback.teKwh
          : null;
    const tusdKwh =
      tarifaVigente && Number.isFinite(tarifaVigente.tusdKwh)
        ? tarifaVigente.tusdKwh
        : tarifaFallback && Number.isFinite(tarifaFallback.tusdKwh)
          ? tarifaFallback.tusdKwh
          : null;

    return {
      distribuidora: item.nome,
      tarifaKwh,
      teKwh,
      tusdKwh
    };
  });
}

async function sincronizarTarifasAneel(force = false) {
  return tarifasAneelData.syncTarifasAneel(force);
}

function sincronizarTarifasAneelEmBackground(force = false) {
  tarifasAneelData.syncTarifasAneel(force).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

function deveSincronizarTarifasNoMes(dataReferencia = new Date()) {
  const mesAtual = obterChaveMes(dataReferencia);
  return mesAtual !== ultimoMesSincronizado;
}

async function sincronizarTarifasNoMes(dataReferencia = new Date()) {
  const mesAtual = obterChaveMes(dataReferencia);
  const diaAtual = obterChaveDia(dataReferencia);

  if (mesAtual === ultimoMesSincronizado) {
    return tarifasAneelData.getTarifasCache();
  }

  if (ultimoDiaTentativaSemSucesso === diaAtual) {
    return tarifasAneelData.getTarifasCache();
  }

  const statusAntes = tarifasAneelData.getStatusSincronizacao();
  await tarifasAneelData.syncTarifasAneel(true);
  const statusDepois = tarifasAneelData.getStatusSincronizacao();

  if (statusDepois.ultimaSincronizacao > statusAntes.ultimaSincronizacao) {
    ultimoMesSincronizado = mesAtual;
    ultimoDiaTentativaSemSucesso = "";
  } else {
    ultimoDiaTentativaSemSucesso = diaAtual;
  }

  return tarifasAneelData.getTarifasCache();
}

function sincronizarTarifasNoMesEmBackground(dataReferencia = new Date()) {
  sincronizarTarifasNoMes(dataReferencia).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
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
  sincronizarTarifasAneelEmBackground,
  deveSincronizarTarifasNoMes,
  sincronizarTarifasNoMes,
  sincronizarTarifasNoMesEmBackground,
  obterTarifaVigentePorSigAgente,
  obterTarifaVigentePorDistribuidora,
  __internals: {
    obterChaveMes,
    obterChaveDia,
    identificarMesSincronizadoInicial
  }
};
