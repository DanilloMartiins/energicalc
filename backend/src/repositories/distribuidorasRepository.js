const distribuidorasData = require("../data/distribuidorasData");
const distribuidorasCoberturaData = require("../data/distribuidorasCoberturaData");
const { resolverSigAgentePorCodigo } = require("../data/distribuidoraAneelMap");
const { getPostgresPool } = require("../database/postgresClient");

let cacheDistribuidoras = normalizarListaDistribuidoras(distribuidorasData.getDistribuidoras());
let cacheCoberturaCidades = normalizarListaCobertura(distribuidorasCoberturaData.getCoberturaPadrao());
let indiceCoberturaCidadeUf = construirIndiceCobertura(cacheCoberturaCidades);
let inicializacaoEmAndamento = null;

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarCidade(cidade) {
  return removerAcentos(cidade)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizarUf(uf) {
  return removerAcentos(uf).trim().toUpperCase();
}

function normalizarListaDistribuidoras(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const codigo = String(item && item.codigo ? item.codigo : "").trim().toUpperCase();
      const nome = String(item && item.nome ? item.nome : "").trim();
      const uf = normalizarUf(item && item.uf);

      if (!codigo || !nome || !uf) {
        return null;
      }

      return { codigo, nome, uf };
    })
    .filter(Boolean);
}

function normalizarListaCobertura(lista) {
  if (!Array.isArray(lista)) {
    return [];
  }

  return lista
    .map((item) => {
      const uf = normalizarUf(item && item.uf);
      const cidade = String(item && item.cidade ? item.cidade : "").trim();
      const cidadeNormalizada = normalizarCidade(cidade);
      const codMunicipio = String(item && item.codMunicipio ? item.codMunicipio : "").trim();
      const distribuidoraCodigo = String(
        item && item.distribuidoraCodigo ? item.distribuidoraCodigo : ""
      )
        .trim()
        .toUpperCase();

      if (!uf || !cidade || !cidadeNormalizada || !distribuidoraCodigo) {
        return null;
      }

      return {
        uf,
        cidade,
        codMunicipio,
        cidadeNormalizada,
        distribuidoraCodigo
      };
    })
    .filter(Boolean);
}

function cloneLista(lista) {
  return lista.map((item) => ({ ...item }));
}

function construirChaveCidadeUf(cidadeNormalizada, ufNormalizada) {
  return `${ufNormalizada}|${cidadeNormalizada}`;
}

function construirIndiceCobertura(listaCobertura) {
  const mapa = new Map();

  listaCobertura.forEach((item) => {
    const chave = construirChaveCidadeUf(item.cidadeNormalizada, item.uf);
    mapa.set(chave, item.distribuidoraCodigo);
  });

  return mapa;
}

async function criarEstruturaSeNecessario(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS distribuidoras (
      id BIGSERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      uf VARCHAR(2) NOT NULL,
      sig_agente_aneel TEXT,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS distribuidoras_cobertura_cidades (
      id BIGSERIAL PRIMARY KEY,
      uf VARCHAR(2) NOT NULL,
      cidade TEXT NOT NULL,
      cod_municipio VARCHAR(7),
      cidade_norm TEXT NOT NULL,
      distribuidora_codigo TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT distribuidoras_cobertura_cidades_uk UNIQUE (uf, cidade_norm),
      CONSTRAINT distribuidoras_cobertura_cidades_fk
        FOREIGN KEY (distribuidora_codigo)
        REFERENCES distribuidoras(codigo)
    );
  `);

  await client.query(`
    ALTER TABLE distribuidoras_cobertura_cidades
    ADD COLUMN IF NOT EXISTS cod_municipio VARCHAR(7);
  `);
}

async function seedDistribuidorasSeVazio(client) {
  const response = await client.query("SELECT COUNT(1)::int AS total FROM distribuidoras;");
  const total = Number(response.rows[0] && response.rows[0].total);

  if (Number.isFinite(total) && total > 0) {
    return;
  }

  for (const item of cacheDistribuidoras) {
    const sigAgente = resolverSigAgentePorCodigo(item.codigo);
    await client.query(
      `
        INSERT INTO distribuidoras (codigo, nome, uf, sig_agente_aneel, ativo)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (codigo)
        DO UPDATE SET
          nome = EXCLUDED.nome,
          uf = EXCLUDED.uf,
          sig_agente_aneel = EXCLUDED.sig_agente_aneel,
          ativo = TRUE,
          updated_at = NOW();
      `,
      [item.codigo, item.nome, item.uf, sigAgente]
    );
  }
}

async function seedCoberturaSeVazio(client) {
  const response = await client.query(
    "SELECT COUNT(1)::int AS total FROM distribuidoras_cobertura_cidades;"
  );
  const total = Number(response.rows[0] && response.rows[0].total);

  if (Number.isFinite(total) && total > 0) {
    return;
  }

  for (const item of cacheCoberturaCidades) {
    await client.query(
      `
        INSERT INTO distribuidoras_cobertura_cidades (
          uf,
          cidade,
          cod_municipio,
          cidade_norm,
          distribuidora_codigo,
          ativo
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (uf, cidade_norm)
        DO UPDATE SET
          cidade = EXCLUDED.cidade,
          cod_municipio = EXCLUDED.cod_municipio,
          distribuidora_codigo = EXCLUDED.distribuidora_codigo,
          ativo = TRUE,
          updated_at = NOW();
      `,
      [item.uf, item.cidade, item.codMunicipio || null, item.cidadeNormalizada, item.distribuidoraCodigo]
    );
  }
}

async function carregarDistribuidorasDoBanco(client) {
  const response = await client.query(`
    SELECT codigo, nome, uf
    FROM distribuidoras
    WHERE ativo = TRUE
    ORDER BY id ASC;
  `);

  return normalizarListaDistribuidoras(response.rows);
}

async function carregarCoberturaDoBanco(client) {
  const response = await client.query(`
    SELECT uf, cidade, distribuidora_codigo
      , cod_municipio
    FROM distribuidoras_cobertura_cidades
    WHERE ativo = TRUE
    ORDER BY id ASC;
  `);

  const lista = response.rows.map((item) => ({
      uf: item.uf,
      cidade: item.cidade,
      codMunicipio: item.cod_municipio,
      distribuidoraCodigo: item.distribuidora_codigo
    }));

  return normalizarListaCobertura(lista);
}

async function inicializarRepositorio() {
  if (inicializacaoEmAndamento) {
    return inicializacaoEmAndamento;
  }

  inicializacaoEmAndamento = (async () => {
    const pool = getPostgresPool();

    if (!pool) {
      return {
        bancoHabilitado: false,
        totalDistribuidoras: cacheDistribuidoras.length,
        totalCoberturaCidades: cacheCoberturaCidades.length
      };
    }

    await criarEstruturaSeNecessario(pool);
    await seedDistribuidorasSeVazio(pool);
    await seedCoberturaSeVazio(pool);

    const listaDb = await carregarDistribuidorasDoBanco(pool);
    const coberturaDb = await carregarCoberturaDoBanco(pool);

    if (listaDb.length > 0) {
      cacheDistribuidoras = listaDb;
    }

    if (coberturaDb.length > 0) {
      cacheCoberturaCidades = coberturaDb;
      indiceCoberturaCidadeUf = construirIndiceCobertura(cacheCoberturaCidades);
    }

    return {
      bancoHabilitado: true,
      totalDistribuidoras: cacheDistribuidoras.length,
      totalCoberturaCidades: cacheCoberturaCidades.length
    };
  })();

  try {
    return await inicializacaoEmAndamento;
  } finally {
    inicializacaoEmAndamento = null;
  }
}

function inicializarRepositorioEmBackground() {
  inicializarRepositorio().catch(() => {
    // Mantem fluxo da API funcionando com cache local.
  });
}

function listarDistribuidorasCache() {
  return cloneLista(cacheDistribuidoras);
}

function listarCoberturaCache() {
  return cacheCoberturaCidades.map((item) => ({
    uf: item.uf,
    cidade: item.cidade,
    codMunicipio: item.codMunicipio,
    distribuidoraCodigo: item.distribuidoraCodigo
  }));
}

function obterDistribuidoraPorIdOuCodigo(idOuCodigo) {
  const valor = String(idOuCodigo || "").trim().toUpperCase();
  if (!valor) {
    return null;
  }

  return (
    cacheDistribuidoras.find((item, index) => {
      const idNumerico = String(index + 1);
      return valor === idNumerico || valor === String(item.codigo);
    }) || null
  );
}

function obterDistribuidoraPorNome(nome) {
  const nomeInformado = String(nome || "").trim().toLowerCase();
  if (!nomeInformado) {
    return null;
  }

  return (
    cacheDistribuidoras.find((item) => String(item.nome || "").trim().toLowerCase() === nomeInformado) ||
    null
  );
}

function resolverDistribuidoraCodigoPorCidadeUf(cidade, uf) {
  const ufNormalizada = normalizarUf(uf);
  const cidadeNormalizada = normalizarCidade(cidade);

  if (!ufNormalizada || !cidadeNormalizada) {
    return null;
  }

  const chave = construirChaveCidadeUf(cidadeNormalizada, ufNormalizada);
  return indiceCoberturaCidadeUf.get(chave) || null;
}

async function sincronizarListaDistribuidoras(listaDistribuidoras) {
  const listaNormalizada = normalizarListaDistribuidoras(listaDistribuidoras);
  if (listaNormalizada.length === 0) {
    return cloneLista(cacheDistribuidoras);
  }

  const pool = getPostgresPool();
  if (!pool) {
    cacheDistribuidoras = listaNormalizada;
    return cloneLista(cacheDistribuidoras);
  }

  await criarEstruturaSeNecessario(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of listaNormalizada) {
      const sigAgente = resolverSigAgentePorCodigo(item.codigo);
      await client.query(
        `
          INSERT INTO distribuidoras (codigo, nome, uf, sig_agente_aneel, ativo)
          VALUES ($1, $2, $3, $4, TRUE)
          ON CONFLICT (codigo)
          DO UPDATE SET
            nome = EXCLUDED.nome,
            uf = EXCLUDED.uf,
            sig_agente_aneel = EXCLUDED.sig_agente_aneel,
            ativo = TRUE,
            updated_at = NOW();
        `,
        [item.codigo, item.nome, item.uf, sigAgente]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const listaDb = await carregarDistribuidorasDoBanco(pool);
  cacheDistribuidoras = listaDb.length > 0 ? listaDb : listaNormalizada;
  return cloneLista(cacheDistribuidoras);
}

async function sincronizarCoberturaCidades(listaCobertura) {
  const listaNormalizada = normalizarListaCobertura(listaCobertura);
  if (listaNormalizada.length === 0) {
    return listarCoberturaCache();
  }

  const pool = getPostgresPool();
  if (!pool) {
    cacheCoberturaCidades = listaNormalizada;
    indiceCoberturaCidadeUf = construirIndiceCobertura(cacheCoberturaCidades);
    return listarCoberturaCache();
  }

  await criarEstruturaSeNecessario(pool);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const item of listaNormalizada) {
      await client.query(
        `
          INSERT INTO distribuidoras_cobertura_cidades (
            uf,
            cidade,
            cod_municipio,
            cidade_norm,
            distribuidora_codigo,
            ativo
          )
          VALUES ($1, $2, $3, $4, $5, TRUE)
          ON CONFLICT (uf, cidade_norm)
          DO UPDATE SET
            cidade = EXCLUDED.cidade,
            cod_municipio = EXCLUDED.cod_municipio,
            distribuidora_codigo = EXCLUDED.distribuidora_codigo,
            ativo = TRUE,
            updated_at = NOW();
        `,
        [item.uf, item.cidade, item.codMunicipio || null, item.cidadeNormalizada, item.distribuidoraCodigo]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const coberturaDb = await carregarCoberturaDoBanco(pool);
  cacheCoberturaCidades = coberturaDb.length > 0 ? coberturaDb : listaNormalizada;
  indiceCoberturaCidadeUf = construirIndiceCobertura(cacheCoberturaCidades);
  return listarCoberturaCache();
}

module.exports = {
  inicializarRepositorio,
  inicializarRepositorioEmBackground,
  listarDistribuidorasCache,
  listarCoberturaCache,
  obterDistribuidoraPorIdOuCodigo,
  obterDistribuidoraPorNome,
  resolverDistribuidoraCodigoPorCidadeUf,
  sincronizarListaDistribuidoras,
  sincronizarCoberturaCidades,
  __internals: {
    normalizarListaDistribuidoras,
    normalizarListaCobertura,
    normalizarCidade,
    normalizarUf,
    construirIndiceCobertura
  }
};
