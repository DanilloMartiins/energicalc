const calculoService = require("../../src/services/calculoService");
const tarifasService = require("../../src/services/tarifasService");

describe("calculoService", () => {
  describe("calcular", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("deve calcular a fatura com itens detalhados e aviso", () => {
      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "ENEL_SP",
        bandeira: "verde"
      });

      expect(resultado).toMatchObject({
        statusSimulacao: "simulado",
        distribuidora: "Enel São Paulo",
        consumoKwh: 50,
        mediaDiaria: 1.67,
        diasDecorridos: 30,
        valorEnergia: 47.5,
        bandeira: {
          tipo: "verde",
          valor: 0
        },
        icms: 5.7,
        cip: null,
        cipCalculadaSeparadamente: true,
        aviso: expect.any(String)
      });
      expect(Array.isArray(resultado.itens)).toBe(true);
      expect(resultado.itens.length).toBeGreaterThan(0);
      expect(resultado.total).toBe(57.59);
    });

    it("deve aceitar cidade + uf quando distribuidoraId nao for enviado", () => {
      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        cidade: "Campinas",
        uf: "SP",
        bandeira: "verde"
      });

      expect(resultado.distribuidora).toBe("CPFL Paulista");
      expect(resultado.uf).toBe("SP");
      expect(resultado.total).toBe(54.56);
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
      expect(resultado.total).toBe(58.73);
    });

    it("deve usar tarifa dinamica quando houver valor vigente para distribuidora", () => {
      jest.spyOn(tarifasService, "obterTarifaVigentePorDistribuidora").mockReturnValue({
        sigAgente: "ENEL SP",
        tarifaKwh: 1.2,
        teKwh: 0.3,
        tusdKwh: 0.9,
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
      expect(resultado.total).toBe(72.75);
      expect(resultado.itens).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codigo: "te", valor: 15 }),
          expect.objectContaining({ codigo: "tusd", valor: 45 })
        ])
      );
    });

    it("deve retornar erro 404 para distribuidora inexistente", () => {
      let erro;

      try {
        calculoService.calcular({
          leituraAnterior: 100,
          leituraAtual: 150,
          diasDecorridos: 30,
          distribuidoraId: "999",
          bandeira: "verde"
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
          distribuidoraId: "ENEL_SP",
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
