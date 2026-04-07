const request = require("supertest");
const app = require("../../src/app");

describe("Rotas da API", () => {
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
