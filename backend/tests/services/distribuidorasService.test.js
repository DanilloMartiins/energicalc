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

  it("deve resolver distribuidora por cidade e UF", () => {
    expect(distribuidorasService.obterDistribuidoraPorCidadeUf("Campinas", "SP")).toEqual({
      codigo: "CPFL_PAULISTA",
      nome: "CPFL Paulista",
      uf: "SP"
    });

    const saoPaulo = distribuidorasService.obterDistribuidoraPorCidadeUf("Sao Paulo", "SP");
    expect(saoPaulo).toBeTruthy();
    expect(saoPaulo.uf).toBe("SP");
    expect(typeof saoPaulo.codigo).toBe("string");
    expect(saoPaulo.codigo.length).toBeGreaterThan(0);
  });

  it("deve resolver cidade com acento e caixa variada", () => {
    const saoPaulo = distribuidorasService.obterDistribuidoraPorCidadeUf("Sao Paulo", "sp");
    expect(saoPaulo).toBeTruthy();
    expect(saoPaulo.uf).toBe("SP");
    expect(typeof saoPaulo.codigo).toBe("string");
    expect(saoPaulo.codigo.length).toBeGreaterThan(0);
  });

  it("deve retornar null quando nao houver mapeamento de cidade/UF", () => {
    expect(distribuidorasService.obterDistribuidoraPorCidadeUf("Cidade Inexistente", "SP")).toBeNull();
    expect(distribuidorasService.obterDistribuidoraPorCidadeUf("", "SP")).toBeNull();
    expect(distribuidorasService.obterDistribuidoraPorCidadeUf("Campinas", "")).toBeNull();
  });
});
