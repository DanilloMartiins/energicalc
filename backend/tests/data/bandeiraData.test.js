const fs = require("fs");
const os = require("os");
const path = require("path");

function criarCsvAcionamento(linhas) {
  const cabecalho = "DatCompetencia;NomBandeiraAcionada";
  return [cabecalho, ...linhas].join("\n");
}

function criarCsvAdicional(linhas) {
  const cabecalho = "DatVigencia;NomBandeiraAcionada;VlrAdicionalBandeiraRSMWh";
  return [cabecalho, ...linhas].join("\n");
}

describe("bandeiraData", () => {
  const fetchOriginal = global.fetch;
  const timeoutOriginal = process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS;
  const persistirOriginal = process.env.ANEEL_ATUALIZA_FALLBACK_BANDEIRA;
  const fallbackPathOriginal = process.env.BANDEIRA_FALLBACK_FILE_PATH;

  afterEach(() => {
    global.fetch = fetchOriginal;
    process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS = timeoutOriginal;
    process.env.ANEEL_ATUALIZA_FALLBACK_BANDEIRA = persistirOriginal;
    process.env.BANDEIRA_FALLBACK_FILE_PATH = fallbackPathOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("deve aplicar timeout e manter fallback quando a ANEEL travar", async () => {
    process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS = "20";

    global.fetch = jest.fn((url, options = {}) => {
      return new Promise((resolve, reject) => {
        if (!options.signal) {
          return;
        }

        options.signal.addEventListener("abort", () => {
          const erroAbort = new Error("aborted");
          erroAbort.name = "AbortError";
          reject(erroAbort);
        });
      });
    });

    const bandeiraData = require("../../src/data/bandeiraData");
    const retorno = await bandeiraData.syncBandeiraAtual(true);
    const atual = bandeiraData.getBandeiraAtual();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(retorno).toEqual(atual);
    expect(atual).toHaveProperty("vigente");
    expect(atual).toHaveProperty("valoresKwh");
    expect(Object.keys(atual.valoresKwh).length).toBeGreaterThan(0);
  });

  it("deve deduplicar sincronizacao concorrente", async () => {
    const csvAcionamento = criarCsvAcionamento(["2026-03-01;VERDE"]);
    const csvAdicional = criarCsvAdicional([
      "2026-03-01;VERDE;0,00",
      "2026-03-01;AMARELA;18,85"
    ]);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => csvAcionamento
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => csvAdicional
      });

    const bandeiraData = require("../../src/data/bandeiraData");
    const sync1 = bandeiraData.syncBandeiraAtual(true);
    const sync2 = bandeiraData.syncBandeiraAtual(true);
    const [resultado1, resultado2] = await Promise.all([sync1, sync2]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(resultado1).toEqual(resultado2);
    expect(resultado1.vigente).toBe("verde");
  });

  it("deve atualizar fallback local quando a sincronizacao ANEEL for bem-sucedida", async () => {
    const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-bandeira-"));
    const arquivoFallback = path.join(pastaTemp, "bandeira-fallback.json");

    fs.writeFileSync(
      arquivoFallback,
      JSON.stringify(
        {
          vigente: "amarela",
          valoresKwh: {
            verde: 0,
            amarela: 0.01,
            vermelha_p1: 0.02,
            vermelha_p2: 0.03
          }
        },
        null,
        2
      ),
      "utf-8"
    );

    process.env.ANEEL_ATUALIZA_FALLBACK_BANDEIRA = "true";
    process.env.BANDEIRA_FALLBACK_FILE_PATH = arquivoFallback;

    const csvAcionamento = criarCsvAcionamento(["2026-04-01;VERMELHA PATAMAR 1"]);
    const csvAdicional = criarCsvAdicional([
      "2026-04-01;VERDE;0,00",
      "2026-04-01;AMARELA;18,85",
      "2026-04-01;VERMELHA PATAMAR 1;44,63",
      "2026-04-01;VERMELHA PATAMAR 2;78,77"
    ]);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => csvAcionamento
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => csvAdicional
      });

    const bandeiraData = require("../../src/data/bandeiraData");
    await bandeiraData.syncBandeiraAtual(true);

    const salvo = JSON.parse(fs.readFileSync(arquivoFallback, "utf-8"));

    expect(salvo).toEqual({
      vigente: "vermelha_p1",
      valoresKwh: {
        verde: 0,
        amarela: 0.01885,
        vermelha_p1: 0.04463,
        vermelha_p2: 0.07877,
        escassez_hidrica: 0.142
      }
    });
  });
});
