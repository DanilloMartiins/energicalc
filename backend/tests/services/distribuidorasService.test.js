const distribuidorasService = require("../../src/services/distribuidorasService");

describe("distribuidorasService - mapeamento ANEEL", () => {
  it("deve resolver SigAgente pelo codigo da distribuidora", () => {
    expect(distribuidorasService.obterSigAgenteAneel("ENEL_SP")).toBe("ENEL SP");
    expect(distribuidorasService.obterSigAgenteAneel("CPFL_PAULISTA")).toBe("CPFL PAULISTA");
    expect(distribuidorasService.obterSigAgenteAneel("COELBA")).toBe("COELBA");
  });

  it("deve resolver SigAgente pelo id numerico da distribuidora", () => {
    const lista = distribuidorasService.listarDistribuidoras();
    const idEnel = String(lista.findIndex((item) => item.codigo === "ENEL_SP") + 1);
    const idCpfl = String(lista.findIndex((item) => item.codigo === "CPFL_PAULISTA") + 1);
    const idCoelba = String(lista.findIndex((item) => item.codigo === "COELBA") + 1);

    expect(distribuidorasService.obterSigAgenteAneel(idEnel)).toBe("ENEL SP");
    expect(distribuidorasService.obterSigAgenteAneel(idCpfl)).toBe("CPFL PAULISTA");
    expect(distribuidorasService.obterSigAgenteAneel(idCoelba)).toBe("COELBA");
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
