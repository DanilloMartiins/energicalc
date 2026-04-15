describe("bandeiraService - sincronizacao por calendario oficial", () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("deve forcar sincronizacao quando houver publicacao pendente", async () => {
    const status = { ultimaSincronizacao: 10, ultimaFalha: 0 };

    const syncBandeiraAtual = jest.fn(async () => {
      status.ultimaSincronizacao = 20;
      return {
        vigente: "verde",
        valoresKwh: { verde: 0 }
      };
    });

    jest.doMock("../../src/data/bandeiraData", () => ({
      getBandeiraAtual: jest.fn(() => ({ vigente: "verde", valoresKwh: { verde: 0 } })),
      getStatusSincronizacao: jest.fn(() => ({ ...status })),
      syncBandeiraAtual
    }));

    jest.doMock("../../src/data/bandeiraCalendarioData", () => ({
      obterUltimaPublicacaoAte: jest.fn(() => ({
        dataPublicacao: "2099-01-01",
        mesVigencia: "2099-02",
        timestampInicioDia: 4070908800000
      }))
    }));

    const bandeiraService = require("../../src/services/bandeiraService");

    await bandeiraService.sincronizarBandeiraPorCalendario(new Date());
    expect(syncBandeiraAtual).toHaveBeenCalledTimes(1);
    expect(syncBandeiraAtual).toHaveBeenCalledWith(true);

    await bandeiraService.sincronizarBandeiraPorCalendario(new Date());
    expect(syncBandeiraAtual).toHaveBeenCalledTimes(1);
  });

  it("deve tentar novamente quando ANEEL falhar na data oficial", async () => {
    const status = { ultimaSincronizacao: 10, ultimaFalha: 0 };

    const syncBandeiraAtual = jest.fn(async () => ({
      vigente: "verde",
      valoresKwh: { verde: 0 }
    }));

    jest.doMock("../../src/data/bandeiraData", () => ({
      getBandeiraAtual: jest.fn(() => ({ vigente: "verde", valoresKwh: { verde: 0 } })),
      getStatusSincronizacao: jest.fn(() => ({ ...status })),
      syncBandeiraAtual
    }));

    jest.doMock("../../src/data/bandeiraCalendarioData", () => ({
      obterUltimaPublicacaoAte: jest.fn(() => ({
        dataPublicacao: "2099-01-01",
        mesVigencia: "2099-02",
        timestampInicioDia: 4070908800000
      }))
    }));

    const bandeiraService = require("../../src/services/bandeiraService");

    await bandeiraService.sincronizarBandeiraPorCalendario(new Date());
    await bandeiraService.sincronizarBandeiraPorCalendario(new Date());

    expect(syncBandeiraAtual).toHaveBeenCalledTimes(2);
  });
});

