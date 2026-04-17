const fs = require("fs");
const path = require("path");
const bandeiraData = require("../data/bandeiraData");
const bandeiraCalendarioData = require("../data/bandeiraCalendarioData");

const BANDEIRA_FALLBACK_FILE_PATH = process.env.BANDEIRA_FALLBACK_FILE_PATH
  ? path.resolve(process.env.BANDEIRA_FALLBACK_FILE_PATH)
  : path.resolve(__dirname, "../data/bandeira.json");

let ultimaPublicacaoSincronizada = identificarUltimaPublicacaoJaPersistida();

function obterBandeiraAtual() {
  return bandeiraData.getBandeiraAtual();
}

async function sincronizarBandeiraAtual(force = false) {
  return bandeiraData.syncBandeiraAtual(force);
}

function sincronizarBandeiraAtualEmBackground(force = false) {
  bandeiraData.syncBandeiraAtual(force).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

function identificarUltimaPublicacaoJaPersistida() {
  const ultimaPublicacao = bandeiraCalendarioData.obterUltimaPublicacaoAte(new Date());

  if (!ultimaPublicacao) {
    return 0;
  }

  try {
    const stats = fs.statSync(BANDEIRA_FALLBACK_FILE_PATH);
    const mtimeMs = Number(stats.mtimeMs);

    if (Number.isFinite(mtimeMs) && mtimeMs >= ultimaPublicacao.timestampInicioDia) {
      return ultimaPublicacao.timestampInicioDia;
    }
  } catch (error) {
    // Se o arquivo não existir ou falhar leitura, mantemos comportamento padrão.
  }

  return 0;
}

function deveSincronizarPorCalendario(dataReferencia = new Date()) {
  const ultimaPublicacao = bandeiraCalendarioData.obterUltimaPublicacaoAte(dataReferencia);

  if (!ultimaPublicacao) {
    return false;
  }

  return ultimaPublicacao.timestampInicioDia > ultimaPublicacaoSincronizada;
}

async function sincronizarBandeiraPorCalendario(dataReferencia = new Date()) {
  const ultimaPublicacao = bandeiraCalendarioData.obterUltimaPublicacaoAte(dataReferencia);

  if (!ultimaPublicacao) {
    return bandeiraData.getBandeiraAtual();
  }

  if (ultimaPublicacao.timestampInicioDia <= ultimaPublicacaoSincronizada) {
    return bandeiraData.getBandeiraAtual();
  }

  const statusAntes = bandeiraData.getStatusSincronizacao();
  await bandeiraData.syncBandeiraAtual(true);
  const statusDepois = bandeiraData.getStatusSincronizacao();

  if (statusDepois.ultimaSincronizacao > statusAntes.ultimaSincronizacao) {
    ultimaPublicacaoSincronizada = ultimaPublicacao.timestampInicioDia;
  }

  return bandeiraData.getBandeiraAtual();
}

function sincronizarBandeiraPorCalendarioEmBackground(dataReferencia = new Date()) {
  sincronizarBandeiraPorCalendario(dataReferencia).catch(() => {
    // Não bloqueia o fluxo principal da API quando a ANEEL oscila.
  });
}

function listarTiposBandeira() {
  const bandeira = bandeiraData.getBandeiraAtual();
  const valores = bandeira.valoresKwh || {};
  return Object.keys(valores);
}

function obterAdicionalPorKwh(tipoBandeira) {
  const bandeira = bandeiraData.getBandeiraAtual();
  const valores = bandeira.valoresKwh || {};
  if (!Object.prototype.hasOwnProperty.call(valores, tipoBandeira)) {
    return null;
  }

  return valores[tipoBandeira];
}

module.exports = {
  obterBandeiraAtual,
  sincronizarBandeiraAtual,
  sincronizarBandeiraAtualEmBackground,
  deveSincronizarPorCalendario,
  sincronizarBandeiraPorCalendario,
  sincronizarBandeiraPorCalendarioEmBackground,
  listarTiposBandeira,
  obterAdicionalPorKwh,
  __internals: {
    identificarUltimaPublicacaoJaPersistida
  }
};
