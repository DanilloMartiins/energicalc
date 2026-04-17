const fs = require("fs");
const os = require("os");
const path = require("path");

describe("cipData", () => {
  const cipPathOriginal = process.env.CIP_FILE_PATH;
  const cipProgressPathOriginal = process.env.CIP_PROGRESS_FILE_PATH;

  afterEach(() => {
    process.env.CIP_FILE_PATH = cipPathOriginal;
    process.env.CIP_PROGRESS_FILE_PATH = cipProgressPathOriginal;
    jest.resetModules();
    jest.clearAllMocks();
  });

  function prepararAmbiente(baseInicial) {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "energicalc-cip-data-"));
    const arquivoCip = path.join(pasta, "cip.json");
    const arquivoProgresso = path.join(pasta, "cipProgress.json");

    fs.writeFileSync(arquivoCip, `${JSON.stringify(baseInicial, null, 2)}\n`, "utf8");
    fs.writeFileSync(arquivoProgresso, "[]\n", "utf8");
    process.env.CIP_FILE_PATH = arquivoCip;
    process.env.CIP_PROGRESS_FILE_PATH = arquivoProgresso;
  }

  it("nao deve permitir que estimado sobrescreva registro oficial", () => {
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
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 18 }],
        observacoes: "",
        fonte_oficial: true,
        ultima_atualizacao: "2026-04-02T10:00:00.000Z",
        confianca: "alta",
        status: "oficial"
      }
    ]);

    const cipData = require("../../src/data/cipData");
    cipData.upsertRegistrosCip([
      {
        municipio: "Campinas",
        uf: "SP",
        codigoMunicipioIBGE: "3509502",
        lei: null,
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 9 }],
        observacoes: "estimativa",
        fonte_oficial: false,
        ultima_atualizacao: "2026-04-15T10:00:00.000Z",
        confianca: "baixa",
        status: "estimado"
      }
    ]);

    const registro = cipData.encontrarCipPorCidadeUf("Campinas", "SP");
    expect(registro.status).toBe("oficial");
    expect(registro.valores[0].valor).toBe(18);
  });

  it("deve fazer merge incremental sem duplicidade por cidade+UF", () => {
    prepararAmbiente([]);

    const cipData = require("../../src/data/cipData");
    const listaFinal = cipData.upsertRegistrosCip([
      {
        municipio: "Sao Paulo",
        uf: "sp",
        codigoMunicipioIBGE: "3550308",
        lei: {
          numero: "123/2020",
          descricao: "Lei CIP",
          fonte: "https://prefeitura.sp.gov.br/lei-123"
        },
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 14 }],
        observacoes: "",
        fonte_oficial: true,
        ultima_atualizacao: "2026-04-01T10:00:00.000Z",
        confianca: "media",
        status: "oficial"
      },
      {
        municipio: "Sao  Paulo",
        uf: "SP",
        codigoMunicipioIBGE: "3550308",
        lei: {
          numero: "124/2021",
          descricao: "Lei CIP mais recente",
          fonte: "https://prefeitura.sp.gov.br/lei-124"
        },
        modeloCobranca: "valor_fixo",
        valores: [{ faixa_kwh_min: 0, faixa_kwh_max: null, valor: 16 }],
        observacoes: "",
        fonte_oficial: true,
        ultima_atualizacao: "2026-04-10T10:00:00.000Z",
        confianca: "alta",
        status: "oficial"
      }
    ]);

    expect(listaFinal).toHaveLength(1);
    expect(listaFinal[0].municipio).toBe("Sao Paulo");
    expect(listaFinal[0].valores[0].valor).toBe(16);
    expect(listaFinal[0].lei.numero).toBe("124/2021");
  });
});
