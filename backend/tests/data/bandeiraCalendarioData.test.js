const bandeiraCalendarioData = require("../../src/data/bandeiraCalendarioData");

describe("bandeiraCalendarioData", () => {
  it("deve listar publicacoes oficiais ordenadas por data", () => {
    const lista = bandeiraCalendarioData.listarPublicacoesOficiais();

    expect(lista.length).toBeGreaterThan(0);
    expect(lista[0].dataPublicacao <= lista[lista.length - 1].dataPublicacao).toBe(true);
  });

  it("deve encontrar a ultima publicacao valida ate a data de referencia", () => {
    const dataReferencia = new Date(2026, 3, 24, 10, 0, 0); // 24/04/2026
    const ultima = bandeiraCalendarioData.obterUltimaPublicacaoAte(dataReferencia);

    expect(ultima).toEqual(
      expect.objectContaining({
        dataPublicacao: "2026-04-24",
        mesVigencia: "2026-05"
      })
    );
    expect(Number.isFinite(ultima.timestampInicioDia)).toBe(true);
  });

  it("deve retornar null quando data de referencia for antes da primeira publicacao", () => {
    const dataReferencia = new Date(2024, 11, 31, 12, 0, 0);
    const ultima = bandeiraCalendarioData.obterUltimaPublicacaoAte(dataReferencia);

    expect(ultima).toBeNull();
  });
});

