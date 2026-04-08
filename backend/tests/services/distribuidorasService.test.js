const distribuidorasService = require("../../src/services/distribuidorasService");

describe("distribuidorasService - mapeamento ANEEL", () => {
  it("deve resolver SigAgente pelo codigo da distribuidora", () => {
    expect(distribuidorasService.obterSigAgenteAneel("ENEL_SP")).toBe("ENEL SP");
    expect(distribuidorasService.obterSigAgenteAneel("CPFL_PAULISTA")).toBe("CPFL PAULISTA");
    expect(distribuidorasService.obterSigAgenteAneel("COELBA")).toBe("COELBA");
  });

  it("deve resolver SigAgente pelo id numerico da distribuidora", () => {
    expect(distribuidorasService.obterSigAgenteAneel("1")).toBe("ENEL SP");
    expect(distribuidorasService.obterSigAgenteAneel("2")).toBe("CPFL PAULISTA");
    expect(distribuidorasService.obterSigAgenteAneel("3")).toBe("COELBA");
  });

  it("deve retornar null para distribuidora inexistente", () => {
    expect(distribuidorasService.obterSigAgenteAneel("999")).toBeNull();
    expect(distribuidorasService.obterSigAgenteAneel("NAO_EXISTE")).toBeNull();
  });
});
