const request = require("supertest");
const app = require("../../src/app");

describe("Rotas da API", () => {
  it("GET /health deve retornar status ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
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
      distribuidora: "Enel Sao Paulo",
      consumoKwh: 50,
      total: 51.25
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
    expect(response.body.erro).toBe(
      "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero."
    );
  });

  it("rota nao encontrada deve retornar 404", async () => {
    const response = await request(app).get("/rota-que-nao-existe");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ erro: "Rota nao encontrada." });
  });
});
