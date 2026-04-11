const request = require("supertest");
const app = require("../../src/app");

describe("Rotas da API", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Sem rede para teste"));
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  it("GET /health deve retornar status ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: { status: "ok" }
    });
  });

  it("GET /api/calculo valido deve retornar 200", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 1,
        bandeira: "verde"
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        distribuidora: "Enel Sao Paulo",
        consumoKwh: 50,
        total: 51.25
      }
    });
  });

  it("GET /api/calculo deve aplicar a bandeira enviada", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 1,
        bandeira: "amarela"
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        bandeira: {
          tipo: "amarela",
          valor: 0.94
        },
        total: 52.42
      }
    });
  });

  it("GET /api/calculo invalido deve retornar 400", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 0,
        distribuidoraId: 1,
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero."
      }
    });
  });

  it("GET /api/distribuidoras com filtro uf deve retornar apenas a UF informada", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ uf: "SP" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(2);
    response.body.data.forEach((item) => {
      expect(item.uf).toBe("SP");
    });
  });

  it("GET /api/distribuidoras com filtro nome deve retornar match parcial sem case sensitive", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ nome: "neoenergia" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          codigo: "COELBA",
          nome: "Neoenergia Coelba",
          uf: "BA"
        }
      ]
    });
  });

  it("GET /api/distribuidoras com filtros combinados deve aplicar uf e nome", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ uf: "BA", nome: "neoenergia" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          codigo: "COELBA",
          nome: "Neoenergia Coelba",
          uf: "BA"
        }
      ]
    });
  });

  it("GET /api/distribuidoras com paginacao deve retornar items e metadata", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination).toEqual({
      page: 1,
      limit: 2,
      totalItems: 3,
      totalPages: 2
    });
  });

  it("GET /api/distribuidoras com page invalida deve retornar 400", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ page: 0, limit: 10 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "page deve ser um numero maior que zero."
      }
    });
  });

  it("GET /api/distribuidoras com limit invalido deve retornar 400", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ page: 1, limit: "abc" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "limit deve ser um numero maior que zero."
      }
    });
  });

  it("GET /api/tarifas deve retornar 200 com lista de tarifas", async () => {
    const response = await request(app).get("/api/tarifas");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          distribuidora: "Enel Sao Paulo",
          tarifaKwh: 0.82
        },
        {
          distribuidora: "CPFL Paulista",
          tarifaKwh: 0.82
        },
        {
          distribuidora: "Neoenergia Coelba",
          tarifaKwh: 0.82
        }
      ]
    });
  });

  it("GET /api/impostos deve retornar 200 com impostos", async () => {
    const response = await request(app).get("/api/impostos");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        icms: 0.25,
        pis: 0.0165,
        cofins: 0.076
      }
    });
  });

  it("POST /api/calculo valido deve retornar 200", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: 250,
        distribuidora: "Enel Sao Paulo",
        bandeira: "verde"
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        distribuidora: "Enel Sao Paulo",
        consumoKwh: 250,
        total: 256.25
      }
    });
  });

  it("POST /api/calculo invalido deve retornar 400", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: -10,
        distribuidora: "Enel Sao Paulo",
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "consumo deve ser maior que zero."
      }
    });
  });

  it("GET /api/tarifas deve refletir tarifas dinamicas da ANEEL", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        [
          "SigAgente;DatInicioVigencia;DatFimVigencia;DscBaseTarifaria;DscSubGrupo;DscModalidadeTarifaria;VlrTUSD;VlrTE",
          "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;900,00;300,00",
          "CPFL PAULISTA;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;600,00;300,00",
          "COELBA;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;500,00;200,00"
        ].join("\n")
    });

    const response = await request(app).get("/api/tarifas");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          distribuidora: "Enel Sao Paulo",
          tarifaKwh: 1.2
        },
        {
          distribuidora: "CPFL Paulista",
          tarifaKwh: 0.9
        },
        {
          distribuidora: "Neoenergia Coelba",
          tarifaKwh: 0.7
        }
      ]
    });
  });

  it("GET /api/calculo deve aplicar tarifa dinamica por distribuidora", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        [
          "SigAgente;DatInicioVigencia;DatFimVigencia;DscBaseTarifaria;DscSubGrupo;DscModalidadeTarifaria;VlrTUSD;VlrTE",
          "ENEL SP;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;900,00;300,00",
          "CPFL PAULISTA;2026-01-01;2099-12-31;Tarifa de Aplicacao;B1;Convencional;600,00;300,00"
        ].join("\n")
    });

    const enel = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "ENEL_SP",
        bandeira: "verde"
      });

    const cpfl = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "CPFL_PAULISTA",
        bandeira: "verde"
      });

    expect(enel.status).toBe(200);
    expect(cpfl.status).toBe(200);
    expect(enel.body.data.valorEnergia).toBe(60);
    expect(enel.body.data.total).toBe(75);
    expect(cpfl.body.data.valorEnergia).toBe(45);
    expect(cpfl.body.data.total).toBe(56.25);
  });

  it("rota nao encontrada deve retornar 404", async () => {
    const response = await request(app).get("/rota-que-nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Rota nao encontrada."
      }
    });
  });
});
