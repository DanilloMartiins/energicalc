const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");

describe("rotas CIP", () => {
  const cipPathOriginal = process.env.CIP_FILE_PATH;
  const cipProgressPathOriginal = process.env.CIP_PROGRESS_FILE_PATH;
  const permissaoEstimativaOriginal = process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK;
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Sem rede para teste"));
  });

  afterEach(() => {
    process.env.CIP_FILE_PATH = cipPathOriginal;
    process.env.CIP_PROGRESS_FILE_PATH = cipProgressPathOriginal;
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = permissaoEstimativaOriginal;
    global.fetch = fetchOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  function prepararAmbiente(dadosCip) {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-cip-routes-"));
    const arquivoCip = path.join(pasta, "cip.json");
    const arquivoProgress = path.join(pasta, "cipProgress.json");

    fs.writeFileSync(arquivoCip, `${JSON.stringify(dadosCip, null, 2)}\n`, "utf8");
    fs.writeFileSync(arquivoProgress, "[]\n", "utf8");

    process.env.CIP_FILE_PATH = arquivoCip;
    process.env.CIP_PROGRESS_FILE_PATH = arquivoProgress;
  }

  it("GET /api/cip deve retornar status oficial", async () => {
    prepararAmbiente([
      {
        municipio: "Campinas",
        uf: "SP",
        codigoMunicipioIBGE: "3509502",
        lei: {
          numero: "11453/2002",
          descricao: "Institui a CIP",
          fonte: "https://prefeitura.campinas.sp.gov.br/lei-11453-2002"
        },
        modeloCobranca: "faixa_consumo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: 200, valor: 12.5 }],
        observacoes: "",
        fonte_oficial: true,
        ultima_atualizacao: "2026-04-01T10:00:00.000Z",
        confianca: "alta",
        status: "oficial"
      }
    ]);

    const app = require("../../src/app");
    const response = await request(app).get("/api/cip").query({ cidade: "Campinas", uf: "SP" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("oficial");
    expect(response.body.data.cip.fonteUrl).toBeTruthy();
    expect(response.body.data.cip.lei).toEqual(
      expect.objectContaining({ numero: "11453/2002", descricao: "Institui a CIP" })
    );
    expect(Object.prototype.hasOwnProperty.call(response.body.data.cip, "fonte")).toBe(false);
  });

  it("GET /api/cip deve retornar status estimado", async () => {
    prepararAmbiente([]);
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = "true";

    const app = require("../../src/app");
    const response = await request(app).get("/api/cip").query({ cidade: "Cidade X", uf: "SP" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("estimado");
    expect(response.body.data.cip.lei).toEqual({ numero: null, descricao: null });
    expect(response.body.data.cip.fonteUrl).toBeNull();
    expect(response.body.data.cip.confianca).toBe("baixa");
  });

  it("GET /api/cip deve retornar status nao_encontrado quando estimativa desativada", async () => {
    prepararAmbiente([]);
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = "false";

    const app = require("../../src/app");
    const response = await request(app).get("/api/cip").query({ cidade: "Cidade Y", uf: "SP" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe("nao_encontrado");
    expect(response.body.data.cip).toEqual({
      modeloCobranca: null,
      valores: [],
      lei: { numero: null, descricao: null },
      fonteUrl: null,
      confianca: null,
      ultimaAtualizacao: null
    });
  });

  it("GET /api/cip deve validar parametros", async () => {
    prepararAmbiente([]);

    const app = require("../../src/app");
    const response = await request(app).get("/api/cip").query({ cidade: "Campinas" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("GET /cip deve retornar 404 para manter contrato oficial em /api/cip", async () => {
    prepararAmbiente([]);

    const app = require("../../src/app");
    const response = await request(app).get("/cip").query({ cidade: "Campinas", uf: "SP" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
