const calculoService = require("../../src/services/calculoService");
const tarifasService = require("../../src/services/tarifasService");

describe("calculoService", () => {
  describe("calcular", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

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
        valorEnergia: 47.5,
        bandeira: {
          tipo: "verde",
          valor: 0
        },
        icms: 11.88,
        cip: 0,
        total: 59.38
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
      expect(resultado.total).toBe(71.25);
    });

    it("deve respeitar a bandeira informada na simulacao", () => {
      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "ENEL_SP",
        bandeira: "amarela"
      });

      expect(resultado.bandeira).toEqual({
        tipo: "amarela",
        valor: 0.94
      });
      expect(resultado.total).toBe(60.55);
    });

    it("deve usar tarifa dinamica quando houver valor vigente para distribuidora", () => {
      jest.spyOn(tarifasService, "obterTarifaVigentePorDistribuidora").mockReturnValue({
        sigAgente: "ENEL SP",
        tarifaKwh: 1.2,
        dataInicioVigencia: Date.now(),
        fonte: "aneel"
      });

      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "ENEL_SP",
        bandeira: "verde"
      });

      expect(resultado.valorEnergia).toBe(60);
      expect(resultado.total).toBe(75);
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

    it("deve retornar erro 400 para bandeira inexistente", () => {
      let erro;

      try {
        calculoService.calcular({
          leituraAnterior: 100,
          leituraAtual: 150,
          diasDecorridos: 30,
          distribuidoraId: "1",
          bandeira: "azul"
        });
      } catch (error) {
        erro = error;
      }

      expect(erro).toBeDefined();
      expect(erro.status).toBe(400);
      expect(erro.message).toBe("Bandeira informada nao existe.");
    });
  });
});
