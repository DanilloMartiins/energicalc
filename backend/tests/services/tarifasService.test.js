describe("tarifasService - sincronizacao mensal", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("deve sincronizar apenas uma vez no mesmo mes quando houver sucesso", async () => {
    const status = { ultimaSincronizacao: 10, ultimaFalhaPorTimeout: 0 };

    const syncTarifasAneel = jest.fn(async () => {
      status.ultimaSincronizacao = 20;
      return [];
    });

    jest.doMock("../../src/data/tarifasAneelData", () => ({
      syncTarifasAneel,
      getStatusSincronizacao: jest.fn(() => ({ ...status })),
      getTarifasCache: jest.fn(() => [])
    }));

    jest.doMock("../../src/data/tarifasData", () => ({
      getTarifas: jest.fn(() => [])
    }));

    jest.doMock("../../src/services/distribuidorasService", () => ({
      listarDistribuidoras: jest.fn(() => [])
    }));

    const tarifasService = require("../../src/services/tarifasService");
    const dataRef = new Date(2099, 0, 14, 10, 0, 0);

    await tarifasService.sincronizarTarifasNoMes(dataRef);
    await tarifasService.sincronizarTarifasNoMes(dataRef);

    expect(syncTarifasAneel).toHaveBeenCalledTimes(1);
    expect(syncTarifasAneel).toHaveBeenCalledWith(true);
  });

  it("deve tentar novamente diariamente quando a sincronizacao do mes falhar", async () => {
    const status = { ultimaSincronizacao: 10, ultimaFalhaPorTimeout: 0 };

    const syncTarifasAneel = jest.fn(async () => []);

    jest.doMock("../../src/data/tarifasAneelData", () => ({
      syncTarifasAneel,
      getStatusSincronizacao: jest.fn(() => ({ ...status })),
      getTarifasCache: jest.fn(() => [])
    }));

    jest.doMock("../../src/data/tarifasData", () => ({
      getTarifas: jest.fn(() => [])
    }));

    jest.doMock("../../src/services/distribuidorasService", () => ({
      listarDistribuidoras: jest.fn(() => [])
    }));

    const tarifasService = require("../../src/services/tarifasService");
    const dataRefDia1 = new Date(2099, 0, 14, 10, 0, 0);
    const dataRefDia2 = new Date(2099, 0, 15, 10, 0, 0);

    await tarifasService.sincronizarTarifasNoMes(dataRefDia1);
    await tarifasService.sincronizarTarifasNoMes(dataRefDia1);
    await tarifasService.sincronizarTarifasNoMes(dataRefDia2);

    expect(syncTarifasAneel).toHaveBeenCalledTimes(2);
  });
});
