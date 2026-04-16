require("dotenv").config();

const app = require("./app");
const tarifasService = require("./services/tarifasService");
const bandeiraService = require("./services/bandeiraService");
const distribuidorasService = require("./services/distribuidorasService");

const PORT = process.env.PORT || 3000;
const TARIFAS_SYNC_INTERVALO_PADRAO_MS = 6 * 60 * 60 * 1000;
const intervaloConfigurado = Number(process.env.ANEEL_TARIFAS_SYNC_INTERVAL_MS);
const intervaloSincronizacaoMs =
  Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0
    ? intervaloConfigurado
    : TARIFAS_SYNC_INTERVALO_PADRAO_MS;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  distribuidorasService.inicializarDistribuidorasRepositoryEmBackground();
  tarifasService.sincronizarTarifasNoMesEmBackground();
  bandeiraService.sincronizarBandeiraPorCalendarioEmBackground();
  distribuidorasService.sincronizarDistribuidorasAneelEmBackground(true);
  distribuidorasService.sincronizarCoberturaDistribuidorasNoMesEmBackground();
});

const timerSincronizacaoTarifas = setInterval(() => {
  tarifasService.sincronizarTarifasNoMesEmBackground();
  bandeiraService.sincronizarBandeiraPorCalendarioEmBackground();
  distribuidorasService.sincronizarDistribuidorasAneelEmBackground(true);
  distribuidorasService.sincronizarCoberturaDistribuidorasNoMesEmBackground();
}, intervaloSincronizacaoMs);

if (typeof timerSincronizacaoTarifas.unref === "function") {
  timerSincronizacaoTarifas.unref();
}
