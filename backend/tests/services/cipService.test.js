const fs = require("fs");
const os = require("os");
const path = require("path");

describe("cipService", () => {
  const cipPathOriginal = process.env.CIP_FILE_PATH;
  const cipProgressPathOriginal = process.env.CIP_PROGRESS_FILE_PATH;
  const permissaoEstimativaOriginal = process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK;

  afterEach(() => {
    process.env.CIP_FILE_PATH = cipPathOriginal;
    process.env.CIP_PROGRESS_FILE_PATH = cipProgressPathOriginal;
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = permissaoEstimativaOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  function criarArquivosTemporarios(dadosCip) {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-cip-"));
    const arquivoCip = path.join(pasta, "cip.json");
    const arquivoProgresso = path.join(pasta, "cipProgress.json");

    fs.writeFileSync(arquivoCip, `${JSON.stringify(dadosCip, null, 2)}\n`, "utf8");
    fs.writeFileSync(arquivoProgresso, "[]\n", "utf8");

    return { arquivoCip, arquivoProgresso };
  }

  function validarShapePadraoCip(cip) {
    expect(cip).toHaveProperty("modeloCobranca");
    expect(cip).toHaveProperty("valores");
    expect(cip).toHaveProperty("lei");
    expect(cip).toHaveProperty("fonteUrl");
    expect(cip).toHaveProperty("confianca");
    expect(cip).toHaveProperty("ultimaAtualizacao");
    expect(Array.isArray(cip.valores)).toBe(true);
    expect(cip.lei).toHaveProperty("numero");
    expect(cip.lei).toHaveProperty("descricao");
  }

  it("deve retornar status oficial com contrato padronizado", () => {
    const { arquivoCip, arquivoProgresso } = criarArquivosTemporarios([
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

    process.env.CIP_FILE_PATH = arquivoCip;
    process.env.CIP_PROGRESS_FILE_PATH = arquivoProgresso;

    const cipService = require("../../src/services/cipService");
    const resultado = cipService.getCipPorCidade("Campinas", "SP");

    expect(resultado.status).toBe("oficial");
    expect(resultado.mensagem).toBeNull();
    expect(resultado.cip.lei).toEqual({
      numero: "11453/2002",
      descricao: "Institui a CIP"
    });
    expect(resultado.cip.fonteUrl).toBe("https://prefeitura.campinas.sp.gov.br/lei-11453-2002");
    expect(resultado.cip.confianca).toBe("alta");
    expect(resultado.cip.ultimaAtualizacao).toBe("2026-04-01T10:00:00.000Z");
    validarShapePadraoCip(resultado.cip);
    expect(Object.prototype.hasOwnProperty.call(resultado.cip, "fonte")).toBe(false);
  });

  it("deve retornar status estimado com mensagem e baixa confianca", () => {
    const { arquivoCip, arquivoProgresso } = criarArquivosTemporarios([
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
        valores: [
          { faixa_kwh_min: 0, faixa_kwh_max: 100, valor: 10 },
          { faixa_kwh_min: 101, faixa_kwh_max: 220, valor: 20 }
        ],
        observacoes: "",
        fonte_oficial: true,
        ultima_atualizacao: "2026-04-01T10:00:00.000Z",
        confianca: "alta",
        status: "oficial"
      }
    ]);

    process.env.CIP_FILE_PATH = arquivoCip;
    process.env.CIP_PROGRESS_FILE_PATH = arquivoProgresso;
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = "true";

    const cipService = require("../../src/services/cipService");
    const resultado = cipService.getCipPorCidade("Cidade Sem Lei", "SP");

    expect(resultado.status).toBe("estimado");
    expect(resultado.mensagem).toContain("estimada");
    expect(resultado.cip.confianca).toBe("baixa");
    expect(resultado.cip.fonteUrl).toBeNull();
    expect(resultado.cip.lei).toEqual({
      numero: null,
      descricao: null
    });
    expect(typeof resultado.cip.ultimaAtualizacao).toBe("string");
    expect(resultado.cip.ultimaAtualizacao.length).toBeGreaterThan(0);
    validarShapePadraoCip(resultado.cip);
  });

  it("deve retornar status nao_encontrado com shape padrao", () => {
    const { arquivoCip, arquivoProgresso } = criarArquivosTemporarios([]);

    process.env.CIP_FILE_PATH = arquivoCip;
    process.env.CIP_PROGRESS_FILE_PATH = arquivoProgresso;
    process.env.CIP_PERMITIR_ESTIMATIVA_FALLBACK = "false";

    const cipService = require("../../src/services/cipService");
    const resultado = cipService.getCipPorCidade("Cidade Sem Lei", "SP");

    expect(resultado.status).toBe("nao_encontrado");
    expect(resultado.mensagem).toBe("CIP nao cadastrada para este municipio.");
    expect(resultado.cip).toEqual({
      modeloCobranca: null,
      valores: [],
      lei: {
        numero: null,
        descricao: null
      },
      fonteUrl: null,
      confianca: null,
      ultimaAtualizacao: null
    });
    validarShapePadraoCip(resultado.cip);
  });
});
