const billingService = require("../../src/services/billingService");
const tarifasService = require("../../src/services/tarifasService");
const cipService = require("../../src/services/cipService");

describe("billingService", () => {
  const distribuidoraBase = {
    codigo: "ENEL_SP",
    nome: "Enel Sao Paulo",
    uf: "SP"
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function criarConfigBase() {
    return {
      avisoPadrao:
        "Esta simulacao nao considera valores adicionais como multas, juros por atraso, parcelamentos, emprestimos na fatura ou compensacoes/creditos. Caso existam, o valor real pode ser diferente.",
      icmsRegras: [
        {
          uf: "DEFAULT",
          tipo: "percentual",
          valor: 0,
          faixaConsumo: { min: 0, max: null },
          fonte: "nao_oficial",
          confianca: "baixa",
          dataReferencia: "2026-04-01",
          observacao: "Regra default de teste"
        }
      ],
      regulatorios: [],
      impostosMunicipais: []
    };
  }

  function mockTarifa(teKwh = 0.4, tusdKwh = 0.6, fonte = "aneel") {
    jest.spyOn(tarifasService, "obterTarifaVigentePorDistribuidora").mockReturnValue({
      sigAgente: "ENEL SP",
      tarifaKwh: teKwh + tusdKwh,
      teKwh,
      tusdKwh,
      fonte,
      dataInicioVigencia: "2026-01-01"
    });
  }

  function mockCipNaoEncontrado() {
    jest.spyOn(cipService, "getCipPorCidade").mockReturnValue({
      status: "nao_encontrado",
      mensagem: "CIP nao cadastrada para este municipio.",
      municipio: "Cidade X",
      uf: "SP",
      codigoMunicipioIBGE: "0000000",
      cip: {
        modeloCobranca: null,
        valores: [],
        lei: {
          numero: null,
          descricao: null
        },
        fonteUrl: null,
        confianca: null,
        ultimaAtualizacao: null
      }
    });
  }

  it("calculo basico deve montar TE + TUSD", () => {
    mockTarifa();
    mockCipNaoEncontrado();

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao: criarConfigBase(),
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codigo: "te", valor: 40 }),
        expect.objectContaining({ codigo: "tusd", valor: 60 }),
        expect.objectContaining({ codigo: "cip", valor: 0 })
      ])
    );
    expect(resultado.total).toBe(100);
  });

  it("deve aplicar ICMS por estado e marcar baixa confiabilidade", () => {
    mockTarifa();
    mockCipNaoEncontrado();
    const configuracao = criarConfigBase();
    configuracao.icmsRegras = [
      {
        uf: "DEFAULT",
        tipo: "percentual",
        valor: 0.25,
        faixaConsumo: { min: 0, max: null },
        fonte: "nao_oficial",
        confianca: "baixa",
        dataReferencia: "2026-04-01",
        observacao: "Regra default de teste"
      },
      {
        uf: "SP",
        tipo: "percentual",
        valor: 0.18,
        faixaConsumo: { min: 0, max: null },
        fonte: "nao_oficial",
        confianca: "baixa",
        dataReferencia: "2026-04-01",
        observacao: "Regra SP de teste"
      },
      {
        uf: "BA",
        tipo: "percentual",
        valor: 0.25,
        faixaConsumo: { min: 0, max: null },
        fonte: "nao_oficial",
        confianca: "baixa",
        dataReferencia: "2026-04-01",
        observacao: "Regra BA de teste"
      }
    ];

    const resultadoSp = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        uf: "SP",
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    const resultadoBa = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        uf: "BA",
        bandeira: "verde",
        distribuidora: { ...distribuidoraBase, uf: "BA" }
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultadoSp.icms).toBe(18);
    expect(resultadoBa.icms).toBe(25);
    expect(resultadoSp.total).toBe(118);
    expect(resultadoBa.total).toBe(125);

    const itemIcmsSp = resultadoSp.itens.find((item) => item.codigo === "icms");
    expect(itemIcmsSp).toEqual(
      expect.objectContaining({
        origem: "estadual",
        fonte: "nao_oficial",
        confianca: "baixa",
        dataReferencia: expect.stringContaining("2026-04-01")
      })
    );
  });

  it("deve aplicar item percentual", () => {
    mockTarifa();
    mockCipNaoEncontrado();
    const configuracao = criarConfigBase();
    configuracao.regulatorios = [
      {
        codigo: "correcao_monetaria",
        escopo: "nacional",
        modelo: "percentual",
        ativo: true,
        valor: 0.1,
        baseCalculo: "subtotal_energia",
        fonte: "aneel",
        fonteUrl: "https://exemplo.org/regra",
        dataReferencia: "2026-04-01",
        confianca: "media"
      }
    ];

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: "correcao_monetaria",
          valor: 10,
          modelo: "percentual",
          fonte: "aneel",
          confianca: "media"
        })
      ])
    );
    expect(resultado.total).toBe(110);
  });

  it("deve aplicar item fixo", () => {
    mockTarifa();
    mockCipNaoEncontrado();
    const configuracao = criarConfigBase();
    configuracao.regulatorios = [
      {
        codigo: "ipca_nf",
        escopo: "nacional",
        modelo: "fixo",
        ativo: true,
        valor: 5,
        baseCalculo: "subtotal_energia",
        fonte: "aneel",
        fonteUrl: "https://exemplo.org/ipca",
        dataReferencia: "2026-04-01",
        confianca: "media"
      }
    ];

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: "ipca_nf", valor: 5, modelo: "fixo" })])
    );
    expect(resultado.total).toBe(105);
  });

  it("deve incluir aviso, separar status e nao incluir itens proibidos", () => {
    mockTarifa();
    mockCipNaoEncontrado();

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao: criarConfigBase(),
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(typeof resultado.aviso).toBe("string");
    expect(resultado.aviso.length).toBeGreaterThan(0);
    expect(resultado.statusSimulacao).toBe("simulado");
    expect(resultado.cip.status).toBe("nao_encontrado");
    expect(resultado.cip.valor).toBe(0);

    const codigos = resultado.itens.map((item) => item.codigo);
    expect(codigos).not.toEqual(expect.arrayContaining(["multa", "juros", "parcelamento", "emprestimo"]));
    resultado.itens.forEach((item) => {
      expect(item).toHaveProperty("fonte");
      expect(item).toHaveProperty("confianca");
      expect(item).toHaveProperty("dataReferencia");
    });
  });

  it("deve registrar correcao monetaria oficial quando configurada", () => {
    mockTarifa();
    mockCipNaoEncontrado();
    const configuracao = criarConfigBase();
    configuracao.regulatorios = [
      {
        codigo: "correcao_monetaria",
        escopo: "nacional",
        modelo: "percentual",
        ativo: true,
        valor: 0.02,
        baseCalculo: "subtotal_energia",
        fonte: "aneel",
        fonteUrl: "https://www.gov.br/aneel/pt-br/assuntos/noticias/2025/aneel-regulamenta-restituicao-aos-consumidores-de-icms-cobrados-a-mais-por-distribuidoras-de-energia",
        dataReferencia: "2026-04-01",
        confianca: "media"
      }
    ];

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.itens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          codigo: "correcao_monetaria",
          valor: 2,
          fonteUrl: expect.stringContaining("gov.br/aneel"),
          fonte: "aneel",
          confianca: "media",
          dataReferencia: expect.stringContaining("2026-04-01")
        })
      ])
    );
  });

  it("deve integrar CIP oficial ao total da simulacao", () => {
    mockTarifa();
    jest.spyOn(cipService, "getCipPorCidade").mockReturnValue({
      status: "oficial",
      mensagem: null,
      municipio: "Campinas",
      uf: "SP",
      codigoMunicipioIBGE: "3509502",
      cip: {
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 18.75 }],
        lei: { numero: "11453/2002", descricao: "Institui a CIP" },
        fonteUrl: "https://prefeitura.example/lei-11453-2002",
        confianca: "alta",
        ultimaAtualizacao: "2026-04-01T10:00:00.000Z"
      }
    });

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        cidade: "Campinas",
        uf: "SP",
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao: criarConfigBase(),
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.cip).toEqual(
      expect.objectContaining({
        status: "oficial",
        valor: 18.75,
        modeloCobranca: "valor_fixo",
        confianca: "alta",
        lei: {
          numero: "11453/2002",
          descricao: "Institui a CIP"
        }
      })
    );
    expect(resultado.total).toBe(118.75);
    expect(resultado.itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: "cip", valor: 18.75 })])
    );
  });

  it("deve integrar CIP estimada ao total da simulacao", () => {
    mockTarifa();
    jest.spyOn(cipService, "getCipPorCidade").mockReturnValue({
      status: "estimado",
      mensagem: "CIP estimada para este municipio.",
      municipio: "Cidade Y",
      uf: "SP",
      codigoMunicipioIBGE: "0000000",
      cip: {
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 12.5 }],
        lei: { numero: null, descricao: null },
        fonteUrl: null,
        confianca: "baixa",
        ultimaAtualizacao: "2026-04-10T10:00:00.000Z"
      }
    });

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        cidade: "Cidade Y",
        uf: "SP",
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao: criarConfigBase(),
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.cip.status).toBe("estimado");
    expect(resultado.cip.valor).toBe(12.5);
    expect(resultado.total).toBe(112.5);
    expect(resultado.itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: "cip", valor: 12.5 })])
    );
  });

  it("deve manter CIP sem valor inventado quando status for nao_encontrado", () => {
    mockTarifa();
    mockCipNaoEncontrado();

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        cidade: "Cidade Z",
        uf: "SP",
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao: criarConfigBase(),
        impostos: { pis: 0, cofins: 0 }
      }
    );

    expect(resultado.cip.status).toBe("nao_encontrado");
    expect(resultado.cip.valor).toBe(0);
    expect(resultado.itens).toEqual(
      expect.arrayContaining([expect.objectContaining({ codigo: "cip", valor: 0 })])
    );
  });

  it("deve usar fallback parametrizado quando TE/TUSD nao vierem separados", () => {
    jest.spyOn(tarifasService, "obterTarifaVigentePorDistribuidora").mockReturnValue({
      sigAgente: "ENEL SP",
      tarifaKwh: 1,
      teKwh: null,
      tusdKwh: null,
      fonte: "fallback_local",
      dataInicioVigencia: null
    });
    mockCipNaoEncontrado();
    const configuracao = criarConfigBase();
    configuracao.separacaoTarifaFallback = {
      tePercentual: 0.35,
      tusdPercentual: 0.65,
      fonte: "fallback_parametrizado",
      confianca: "baixa",
      ultimaAtualizacao: "2026-04-01"
    };

    const resultado = billingService.calcularFatura(
      {
        leituraAnterior: 100,
        leituraAtual: 200,
        diasDecorridos: 30,
        bandeira: "verde",
        distribuidora: distribuidoraBase
      },
      {
        configuracao,
        impostos: { pis: 0, cofins: 0 }
      }
    );

    const itemTe = resultado.itens.find((item) => item.codigo === "te");
    const itemTusd = resultado.itens.find((item) => item.codigo === "tusd");
    expect(itemTe).toEqual(expect.objectContaining({ valor: 35, fonte: "fallback_parametrizado" }));
    expect(itemTusd).toEqual(expect.objectContaining({ valor: 65, fonte: "fallback_parametrizado" }));
    expect(itemTusd.valor).toBeGreaterThan(0);
  });
});
