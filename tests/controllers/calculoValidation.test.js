const request = require("supertest");
const app = require("../../src/app");

describe("Validacao do endpoint /api/calculo", () => {
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
      erro: "Informe leitura anterior, leitura atual, dias decorridos e nome da distribuidora."
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
      erro: "leitura anterior, leitura atual e dias decorridos devem ser numeros validos."
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
      erro: "leitura anterior, leitura atual e dias decorridos devem ser maiores que zero."
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
      erro: "Distribuidora informada nao existe."
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
    expect(response.body.erro).toContain("Bandeira invalida.");
  });
});
