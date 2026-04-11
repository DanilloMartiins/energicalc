const request = require("supertest");
const app = require("../../src/app");

describe("Validacao do endpoint /api/calculo", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Sem rede para teste"));
  });

  afterAll(() => {
    global.fetch = fetchOriginal;
  });

  it("deve retornar 400 quando faltam parametros obrigatorios", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 1
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
      }
    });
  });

  it("deve retornar 400 para valores nao numericos", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: "abc",
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 1,
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "leitura anterior, leitura atual e dias decorridos devem ser numeros validos."
      }
    });
  });

  it("deve retornar 400 para valores menores ou iguais a zero", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 0,
        leituraAtual: 150,
        diasDecorridos: 30,
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

  it("deve retornar 400 para distribuidora invalida", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 999,
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Distribuidora informada nao existe."
      }
    });
  });

  it("deve retornar 400 para bandeira invalida", async () => {
    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: 1,
        bandeira: "azul"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain("Bandeira invalida.");
  });
});

describe("Validacao do endpoint POST /api/calculo", () => {
  it("deve retornar 400 quando faltam campos obrigatorios no body", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: 250,
        distribuidora: "Enel Sao Paulo"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Informe consumo, nome da distribuidora e bandeira."
      }
    });
  });

  it("deve retornar 400 quando consumo nao e numerico", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: "abc",
        distribuidora: "Enel Sao Paulo",
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "consumo deve ser um numero valido."
      }
    });
  });

  it("deve retornar 400 quando consumo e menor ou igual a zero", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: 0,
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

  it("deve retornar 400 para distribuidora invalida no body", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: 250,
        distribuidora: "Celpe",
        bandeira: "verde"
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Distribuidora informada nao existe."
      }
    });
  });

  it("deve retornar 400 para bandeira invalida no body", async () => {
    const response = await request(app)
      .post("/api/calculo")
      .send({
        consumo: 250,
        distribuidora: "Enel Sao Paulo",
        bandeira: "azul"
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain("Bandeira invalida.");
  });
});
