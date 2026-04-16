const fs = require("fs");
const os = require("os");
const path = require("path");

describe("distribuidorasAneelData", () => {
  const fallbackPathOriginal = process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH;
  const persistirOriginal = process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS;

  afterEach(() => {
    process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH = fallbackPathOriginal;
    process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS = persistirOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("deve carregar fallback local mesclando com base padrao", () => {
    const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-distrib-"));
    const arquivoFallback = path.join(pastaTemp, "distribuidoras-fallback.json");

    fs.writeFileSync(
      arquivoFallback,
      JSON.stringify(
        [
          {
            codigo: "ENEL_SP",
            nome: "Enel Sao Paulo Atualizada",
            uf: "SP"
          }
        ],
        null,
        2
      ),
      "utf-8"
    );

    process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH = arquivoFallback;
    process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS = "false";

    jest.doMock("../../src/data/tarifasAneelData", () => ({
      getTarifasCache: jest.fn().mockReturnValue([])
    }));

    const distribuidorasAneelData = require("../../src/data/distribuidorasAneelData");
    const lista = distribuidorasAneelData.getDistribuidorasCache();

    expect(lista.length).toBeGreaterThanOrEqual(3);
    expect(lista.find((item) => item.codigo === "ENEL_SP")).toEqual({
      codigo: "ENEL_SP",
      nome: "Enel Sao Paulo Atualizada",
      uf: "SP"
    });
    expect(lista.find((item) => item.codigo === "CPFL_PAULISTA")).toBeTruthy();
    expect(lista.find((item) => item.codigo === "COELBA")).toBeTruthy();
  });

  it("deve manter fallback em memoria quando ANEEL falhar", async () => {
    jest.doMock("../../src/data/tarifasAneelData", () => ({
      getTarifasCache: jest.fn(() => {
        throw new Error("falha ANEEL");
      })
    }));

    const distribuidorasAneelData = require("../../src/data/distribuidorasAneelData");
    const lista = await distribuidorasAneelData.syncDistribuidorasAneel(true);

    expect(lista.length).toBeGreaterThanOrEqual(3);
    const codigos = lista.map((item) => item.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["ENEL_SP", "CPFL_PAULISTA", "COELBA"]));
  });

  it("deve persistir fallback local quando sincronizacao ANEEL for bem-sucedida", async () => {
    const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-distrib-save-"));
    const arquivoFallback = path.join(pastaTemp, "distribuidoras-fallback.json");

    fs.writeFileSync(
      arquivoFallback,
      JSON.stringify(
        [
          { codigo: "ENEL_SP", nome: "Enel Sao Paulo", uf: "SP" },
          { codigo: "CPFL_PAULISTA", nome: "CPFL Paulista", uf: "SP" },
          { codigo: "COELBA", nome: "Neoenergia Coelba", uf: "BA" }
        ],
        null,
        2
      ),
      "utf-8"
    );

    process.env.DISTRIBUIDORAS_FALLBACK_FILE_PATH = arquivoFallback;
    process.env.ANEEL_ATUALIZA_FALLBACK_DISTRIBUIDORAS = "true";

    jest.doMock("../../src/data/tarifasAneelData", () => ({
      getTarifasCache: jest.fn().mockReturnValue([
        { sigAgente: "ENEL SP", tarifaKwh: 1.1, fonte: "aneel" },
        { sigAgente: "CPFL PAULISTA", tarifaKwh: 0.9, fonte: "aneel" },
        { sigAgente: "COELBA", tarifaKwh: 0.7, fonte: "aneel" }
      ])
    }));

    const distribuidorasAneelData = require("../../src/data/distribuidorasAneelData");
    await distribuidorasAneelData.syncDistribuidorasAneel(true);

    const salvo = JSON.parse(fs.readFileSync(arquivoFallback, "utf-8"));
    expect(salvo).toEqual(
      expect.arrayContaining([
        { codigo: "ENEL_SP", nome: "Enel Sao Paulo", uf: "SP" },
        { codigo: "CPFL_PAULISTA", nome: "CPFL Paulista", uf: "SP" },
        { codigo: "COELBA", nome: "Neoenergia Coelba", uf: "BA" }
      ])
    );
  });
});
