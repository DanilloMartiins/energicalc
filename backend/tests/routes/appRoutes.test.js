const request = require("supertest");
const app = require("../../src/app");
const tarifasService = require("../../src/services/tarifasService");

function criarFetchLentoComAbort() {
  return jest.fn((url, options = {}) => {
    return new Promise((resolve, reject) => {
      if (!options.signal) {
        return;
      }

      options.signal.addEventListener("abort", () => {
        const erroAbort = new Error("aborted");
        erroAbort.name = "AbortError";
        reject(erroAbort);
      });
    });
  });
}

describe("Rotas da API", () => {
  const fetchOriginal = global.fetch;
  const timeoutTarifasOriginal = process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS;
  const timeoutBandeiraOriginal = process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Sem rede para teste"));
  });

  afterEach(() => {
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = timeoutTarifasOriginal;
    process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS = timeoutBandeiraOriginal;
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
        total: 59.38
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
        total: 60.55
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
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((item) => {
      expect(item.uf).toBe("SP");
    });
    const codigos = response.body.data.map((item) => item.codigo);
    expect(codigos).toContain("ENEL_SP");
    expect(codigos).toContain("CPFL_PAULISTA");
  });

  it("GET /api/distribuidoras com filtro nome deve retornar match parcial sem case sensitive", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ nome: "neoenergia" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((item) => {
      expect(String(item.nome).toLowerCase()).toContain("neoenergia");
    });
    const possuiCoelba = response.body.data.some((item) => item.codigo === "COELBA");
    expect(possuiCoelba).toBe(true);
  });

  it("GET /api/distribuidoras nao deve bloquear quando ANEEL estiver lenta", async () => {
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = "20";
    global.fetch = criarFetchLentoComAbort();
    const inicio = Date.now();

    const response = await request(app).get("/api/distribuidoras");
    const duracaoMs = Date.now() - inicio;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(duracaoMs).toBeLessThan(2000);
  });

  it("GET /api/distribuidoras com filtros combinados deve aplicar uf e nome", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ uf: "BA", nome: "neoenergia" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    response.body.data.forEach((item) => {
      expect(item.uf).toBe("BA");
      expect(String(item.nome).toLowerCase()).toContain("neoenergia");
    });
    const possuiCoelba = response.body.data.some((item) => item.codigo === "COELBA");
    expect(possuiCoelba).toBe(true);
  });

  it("GET /api/distribuidoras/resolver deve retornar distribuidora por cidade + uf", async () => {
    const response = await request(app)
      .get("/api/distribuidoras/resolver")
      .query({ cidade: "Campinas", uf: "SP" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        codigo: "CPFL_PAULISTA",
        nome: "CPFL Paulista",
        uf: "SP"
      }
    });
  });

  it("GET /api/distribuidoras/resolver deve normalizar acentos e caixa", async () => {
    const response = await request(app)
      .get("/api/distribuidoras/resolver")
      .query({ cidade: "Sao Paulo", uf: "sp" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.uf).toBe("SP");
    expect(typeof response.body.data.codigo).toBe("string");
    expect(response.body.data.codigo.length).toBeGreaterThan(0);
  });

  it("GET /api/distribuidoras/resolver deve retornar 404 para cidade sem mapeamento", async () => {
    const response = await request(app)
      .get("/api/distribuidoras/resolver")
      .query({ cidade: "Cidade Inexistente", uf: "SP" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: "Nao foi possivel identificar distribuidora para cidade/UF."
      }
    });
  });

  it("GET /api/distribuidoras com paginacao deve retornar items e metadata", async () => {
    const response = await request(app)
      .get("/api/distribuidoras")
      .query({ page: 1, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(2);
    expect(response.body.data.pagination.totalItems).toBeGreaterThanOrEqual(3);
    expect(response.body.data.pagination.totalPages).toBeGreaterThanOrEqual(2);
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
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ distribuidora: "Enel Sao Paulo", tarifaKwh: 0.95 }),
        expect.objectContaining({ distribuidora: "CPFL Paulista", tarifaKwh: 0.9 }),
        expect.objectContaining({ distribuidora: "Neoenergia Coelba", tarifaKwh: 0.85 })
      ])
    );
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

  it("GET /api/bandeira nao deve bloquear quando ANEEL estiver lenta", async () => {
    process.env.ANEEL_BANDEIRA_FETCH_TIMEOUT_MS = "20";
    global.fetch = criarFetchLentoComAbort();
    const inicio = Date.now();

    const response = await request(app).get("/api/bandeira");
    const duracaoMs = Date.now() - inicio;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty("vigente");
    expect(response.body.data).toHaveProperty("valoresKwh");
    expect(duracaoMs).toBeLessThan(2000);
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
        total: 296.88
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

    await tarifasService.sincronizarTarifasAneel(true);
    const response = await request(app).get("/api/tarifas");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ distribuidora: "Enel Sao Paulo", tarifaKwh: 1.2 }),
        expect.objectContaining({ distribuidora: "CPFL Paulista", tarifaKwh: 0.9 }),
        expect.objectContaining({ distribuidora: "Neoenergia Coelba", tarifaKwh: 0.7 })
      ])
    );
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

    await tarifasService.sincronizarTarifasAneel(true);
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

  it("GET /api/calculo nao deve bloquear quando sincronizacao ANEEL estiver lenta", async () => {
    process.env.ANEEL_TARIFAS_FETCH_TIMEOUT_MS = "20";
    global.fetch = criarFetchLentoComAbort();
    const inicio = Date.now();

    const response = await request(app)
      .get("/api/calculo")
      .query({
        leituraAnterior: 100,
        leituraAtual: 150,
        diasDecorridos: 30,
        distribuidoraId: "CPFL_PAULISTA",
        bandeira: "verde"
      });

    const duracaoMs = Date.now() - inicio;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(duracaoMs).toBeLessThan(2000);
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
