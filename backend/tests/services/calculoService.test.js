const calculoService = require("../../src/services/calculoService");
const tarifasService = require("../../src/services/tarifasService");
const cipService = require("../../src/services/cipService");

describe("calculoService", () => {
  describe("calcular", () => {
    beforeEach(() => {
      jest.spyOn(cipService, "getCipPorCidade").mockReturnValue({
        status: "nao_encontrado",
        mensagem: "CIP nao cadastrada para este municipio.",
        municipio: "Cidade X",
        uf: "SP",
        codigoMunicipioIBGE: "0000000",
        cip: {
          modeloCobranca: null,
          valores: [],
          lei: { numero: null, descricao: null },
          fonteUrl: null,
          confianca: null,
          ultimaAtualizacao: null
        }
      });
    });

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
        cip: {
          status: "nao_encontrado",
          valor: 0
        },
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

    it("deve integrar CIP quando houver retorno oficial para cidade + uf", () => {
      jest.spyOn(cipService, "getCipPorCidade").mockReturnValue({
        status: "oficial",
        mensagem: null,
        municipio: "Campinas",
        uf: "SP",
        codigoMunicipioIBGE: "3509502",
        cip: {
          modeloCobranca: "valor_fixo",
          valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 15 }],
          lei: { numero: "11453/2002", descricao: "Institui a CIP" },
          fonteUrl: "https://prefeitura.example/cip",
          confianca: "alta",
          ultimaAtualizacao: "2026-04-01T10:00:00.000Z"
        }
      });

      const resultado = calculoService.calcular({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        cidade: "Campinas",
        uf: "SP",
        bandeira: "verde"
      });

      expect(resultado.cip).toEqual(
        expect.objectContaining({
          status: "oficial",
          valor: 15,
          modeloCobranca: "valor_fixo"
        })
      );
      expect(resultado.itens).toEqual(
        expect.arrayContaining([expect.objectContaining({ codigo: "cip", valor: 15 })])
      );
      expect(resultado.total).toBe(69.56);
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
