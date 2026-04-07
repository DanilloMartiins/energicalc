const calculoService = require("../../src/services/calculoService");

describe("calculoService", () => {
  describe("calcular", () => {
    it("deve calcular a fatura com dados validos", () => {
      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "1"
      });

      expect(resultado).toEqual({
        distribuidora: "Enel Sao Paulo",
        consumoKwh: 50,
        mediaDiaria: 1.67,
        diasDecorridos: 30,
        valorEnergia: 41,
        bandeira: {
          tipo: "verde",
          valor: 0
        },
        icms: 10.25,
        cip: 0,
        total: 51.25
      });
    });

    it("deve aceitar o codigo da distribuidora", () => {
      const resultado = calculoService.calcular({
        leituraAnterior: 200,
        leituraAtual: 260,
        diasDecorridos: 30,
        distribuidoraId: "ENEL_SP"
      });

      expect(resultado.distribuidora).toBe("Enel Sao Paulo");
      expect(resultado.consumoKwh).toBe(60);
      expect(resultado.total).toBe(61.5);
    });

    it("deve retornar erro 404 para distribuidora inexistente", () => {
      let erro;

      try {
        calculoService.calcular({
          leituraAnterior: 100,
          leituraAtual: 150,
          diasDecorridos: 30,
          distribuidoraId: "9999"
        });
      } catch (error) {
        erro = error;
      }

      expect(erro).toBeDefined();
      expect(erro.status).toBe(404);
      expect(erro.message).toBe("Distribuidora nao encontrada.");
    });
  });
});
