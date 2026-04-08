const {
  normalizarChave,
  resolverSigAgentePorCodigo,
  resolverSigAgentePorNomeDistribuidora
} = require("../../src/data/distribuidoraAneelMap");

describe("distribuidoraAneelMap", () => {
  it("deve normalizar texto removendo acentos, espacos extras e uppercase", () => {
    expect(normalizarChave("  Enel Sao Paulo  ")).toBe("ENEL_SAO_PAULO");
    expect(normalizarChave("Neoenergia Co\u00E9lba")).toBe("NEOENERGIA_COELBA");
  });

  it("deve resolver SigAgente por codigo local com normalizacao", () => {
    expect(resolverSigAgentePorCodigo(" enel_sp ")).toBe("ENEL SP");
    expect(resolverSigAgentePorCodigo("cpfl_paulista")).toBe("CPFL PAULISTA");
  });

  it("deve resolver SigAgente por nome da distribuidora local", () => {
    expect(resolverSigAgentePorNomeDistribuidora("Enel Sao Paulo")).toBe("ENEL SP");
    expect(resolverSigAgentePorNomeDistribuidora("Neoenergia Co\u00E9lba")).toBe("COELBA");
  });
});
