const fs = require("fs");
const path = require("path");
const cipService = require("../src/services/cipService");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    const proximo = argv[i + 1];

    if (!atual.startsWith("--")) {
      continue;
    }

    const chave = atual.slice(2);
    if (!proximo || proximo.startsWith("--")) {
      args[chave] = true;
      continue;
    }

    args[chave] = proximo;
    i += 1;
  }

  return args;
}

function carregarListaMunicipios(caminhoLista) {
  const caminhoAbsoluto = path.resolve(caminhoLista);
  const conteudo = fs.readFileSync(caminhoAbsoluto, "utf8");
  const payload = JSON.parse(conteudo);
  return Array.isArray(payload) ? payload : [];
}

async function processarMunicipio(item) {
  const cidade = String(item && item.cidade ? item.cidade : "").trim();
  const uf = String(item && item.uf ? item.uf : "")
    .trim()
    .toUpperCase();
  const codigoMunicipioIBGE = String(
    item && item.codigoMunicipioIBGE ? item.codigoMunicipioIBGE : ""
  ).trim();

  if (!cidade || uf.length !== 2) {
    return {
      cidade,
      uf,
      status: "ignorado",
      mensagem: "Cidade/UF inválidas"
    };
  }

  const resultado = await cipService.coletarESalvarCipMunicipio({
    cidade,
    uf,
    codigoMunicipioIBGE
  });

  return {
    cidade,
    uf,
    status: resultado.status,
    mensagem: resultado.mensagem || "Processado com sucesso."
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const registros = [];

  if (args.lista) {
    const lista = carregarListaMunicipios(args.lista);
    for (const item of lista) {
      // eslint-disable-next-line no-await-in-loop
      registros.push(await processarMunicipio(item));
    }
  } else if (args.cidade && args.uf) {
    registros.push(
      await processarMunicipio({
        cidade: args.cidade,
        uf: args.uf,
        codigoMunicipioIBGE: args.ibge || ""
      })
    );
  } else {
    throw new Error(
      "Uso: node scripts/cipIncremental.js --cidade Campinas --uf SP [--ibge 3509502] ou --lista caminho.json"
    );
  }

  process.stdout.write(`${JSON.stringify({ total: registros.length, registros }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
