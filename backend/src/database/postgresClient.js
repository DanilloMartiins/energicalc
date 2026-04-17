const { Pool } = require("pg");

let pool = null;

function parseBoolean(valor, padrao = false) {
  if (valor === undefined || valor === null || valor === "") {
    return padrao;
  }

  const normalizado = String(valor).trim().toLowerCase();
  return normalizado === "1" || normalizado === "true" || normalizado === "yes";
}

function obterConfiguracaoDb() {
  const connectionString = process.env.DATABASE_URL
    ? String(process.env.DATABASE_URL).trim()
    : "";

  const dbHost = process.env.DB_HOST ? String(process.env.DB_HOST).trim() : "";
  const dbPort = Number(process.env.DB_PORT || 5432);
  const dbUser = process.env.DB_USER ? String(process.env.DB_USER).trim() : "";
  const dbPassword = process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : "";
  const dbName = process.env.DB_NAME ? String(process.env.DB_NAME).trim() : "";
  const dbSsl = parseBoolean(process.env.DB_SSL, false);
  const dbHabilitado = parseBoolean(process.env.DB_DISTRIBUIDORAS_ENABLED, false);

  const possuiCredenciaisIndividuais = Boolean(dbHost && dbUser && dbName);
  const habilitado = dbHabilitado || Boolean(connectionString) || possuiCredenciaisIndividuais;

  return {
    habilitado,
    connectionString,
    dbHost,
    dbPort,
    dbUser,
    dbPassword,
    dbName,
    dbSsl
  };
}

function criarPool() {
  const config = obterConfiguracaoDb();
  if (!config.habilitado) {
    return null;
  }

  const ssl = config.dbSsl ? { rejectUnauthorized: false } : undefined;

  if (config.connectionString) {
    return new Pool({
      connectionString: config.connectionString,
      ssl
    });
  }

  return new Pool({
    host: config.dbHost,
    port: Number.isFinite(config.dbPort) ? config.dbPort : 5432,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    ssl
  });
}

function getPostgresPool() {
  if (pool) {
    return pool;
  }

  pool = criarPool();
  if (!pool) {
    return null;
  }

  pool.on("error", () => {
    // Erro de conexão não deve derrubar a API.
  });

  return pool;
}

function isPostgresHabilitado() {
  return Boolean(getPostgresPool());
}

module.exports = {
  getPostgresPool,
  isPostgresHabilitado,
  __internals: {
    parseBoolean,
    obterConfiguracaoDb
  }
};
