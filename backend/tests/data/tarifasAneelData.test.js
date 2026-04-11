function criarCsv(linhas) {
  const cabecalho =
    "SigAgente;DatInicioVigencia;DatFimVigencia;DscBaseTarifaria;DscSubGrupo;DscModalidadeTarifaria;VlrTUSD;VlrTE";

  return [cabecalho, ...linhas].join("\n");
}

function criarDeferred() {
  let resolve;
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("tarifasAneelData", () => {
  const fetchOriginal = global.fetch;
  const timeoutOriginal = process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS;

  afterEach(() => {
    global.fetch = fetchOriginal;
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = timeoutOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("deve interpretar CSV em linhas e colunas", () => {
    const tarifasAneelData = require("../../src/data/tarifasAneelData");
    const csv = criarCsv([
      "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;900,00;300,00"
    ]);

    const registros = tarifasAneelData.__internals.parseCsv(csv);

    expect(registros).toHaveLength(1);
    expect(registros[0]).toMatchObject({
      SigAgente: "ENEL SP",
      DscSubGrupo: "B1",
      DscModalidadeTarifaria: "Convencional",
      VlrTUSD: "900,00",
      VlrTE: "300,00"
    });
  });

  it("deve extrair apenas B1 Convencional vigente e escolher a vigencia mais recente", async () => {
    const csv = criarCsv([
      "ENEL SP;2020-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;500,00;300,00",
      "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;900,00;300,00",
      "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Branca;100,00;100,00",
      "CPFL PAULISTA;2020-01-01;2021-12-31;Tarifa de Aplicacao;B1;Convencional;700,00;300,00",
      "COELBA;2020-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;abc;200,00"
    ]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => csv
    });

    const tarifasAneelData = require("../../src/data/tarifasAneelData");
    await tarifasAneelData.syncTarifasAneel(true);

    const enel = tarifasAneelData.getTarifaBySigAgente("ENEL SP");
    const cpfl = tarifasAneelData.getTarifaBySigAgente("CPFL PAULISTA");

    expect(enel).toMatchObject({
      sigAgente: "ENEL SP",
      tarifaKwh: 1.2,
      fonte: "aneel"
    });

    // Como a linha ANEEL da CPFL no CSV de teste esta fora da vigencia,
    // permanece o valor de fallback local nesta etapa.
    expect(cpfl).toMatchObject({
      sigAgente: "CPFL PAULISTA",
      tarifaKwh: 0.82,
      fonte: "fallback_local"
    });
  });

  it("deve reutilizar cache valido sem nova chamada de rede", async () => {
    const csv = criarCsv([
      "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;910,00;290,00"
    ]);

    const fetchOk = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => csv
    });
    global.fetch = fetchOk;

    const tarifasAneelData = require("../../src/data/tarifasAneelData");
    await tarifasAneelData.syncTarifasAneel(true);

    const fetchFalha = jest.fn().mockRejectedValue(new Error("falha de rede"));
    global.fetch = fetchFalha;

    await tarifasAneelData.syncTarifasAneel(false);

    expect(fetchOk).toHaveBeenCalledTimes(1);
    expect(fetchFalha).not.toHaveBeenCalled();
    expect(tarifasAneelData.getTarifaBySigAgente("ENEL SP").tarifaKwh).toBe(1.2);
  });

  it("deve cair no fallback local quando a ANEEL falhar sem cache sincronizado", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("falha de rede"));
    const tarifasAneelData = require("../../src/data/tarifasAneelData");

    const lista = await tarifasAneelData.syncTarifasAneel(true);
    const enel = tarifasAneelData.getTarifaBySigAgente("ENEL SP");

    expect(enel).toMatchObject({
      sigAgente: "ENEL SP",
      tarifaKwh: 0.82,
      fonte: "fallback_local"
    });
    expect(lista.length).toBeGreaterThan(0);
  });

  it("deve deduplicar sincronizacao concorrente", async () => {
    const deferred = criarDeferred();
    const csv = criarCsv([
      "COELBA;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;800,00;400,00"
    ]);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => deferred.promise
    });

    const tarifasAneelData = require("../../src/data/tarifasAneelData");
    const sync1 = tarifasAneelData.syncTarifasAneel(true);
    const sync2 = tarifasAneelData.syncTarifasAneel(true);

    expect(global.fetch).toHaveBeenCalledTimes(1);

    deferred.resolve(csv);
    await Promise.all([sync1, sync2]);
    expect(tarifasAneelData.getTarifaBySigAgente("COELBA").fonte).toBe("aneel");
  });

  it("deve aplicar timeout e retornar fallback quando a ANEEL travar", async () => {
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = "20";

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

    const tarifasAneelData = require("../../src/data/tarifasAneelData");
    const lista = await tarifasAneelData.syncTarifasAneel(true);
    const enel = tarifasAneelData.getTarifaBySigAgente("ENEL SP");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(lista.length).toBeGreaterThan(0);
    expect(enel).toMatchObject({
      sigAgente: "ENEL SP",
      tarifaKwh: 0.82,
      fonte: "fallback_local"
    });
  });

  it("deve respeitar cooldown apos timeout e evitar nova chamada imediata", async () => {
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = "20";
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

    const tarifasAneelData = require("../../src/data/tarifasAneelData");

    await tarifasAneelData.syncTarifasAneel(false);
    await tarifasAneelData.syncTarifasAneel(false);

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
