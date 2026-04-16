const MAPA_SIG_AGENTE_POR_CODIGO = {
  ENEL_SP: "ENEL SP",
  CPFL_PAULISTA: "CPFL PAULISTA",
  COELBA: "COELBA"
};

const MAPA_SIG_AGENTE_POR_NOME_DISTRIBUIDORA = {
  ENEL_SAO_PAULO: "ENEL SP",
  CPFL_PAULISTA: "CPFL PAULISTA",
  NEOENERGIA_COELBA: "COELBA"
};

const MAPA_ALIAS_SIG_AGENTE = {
  ELETROPAULO: "ENEL SP",
  ENEL_SAO_PAULO: "ENEL SP",
  CPFL_PAULISTA: "CPFL PAULISTA"
};

function removerAcentos(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarChave(texto) {
  return removerAcentos(texto)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function gerarCodigoDistribuidoraPorSigAgente(sigAgente) {
  const sigNormalizada = normalizarChave(sigAgente);
  const sigCanonica = normalizarChave(
    MAPA_ALIAS_SIG_AGENTE[sigNormalizada] || sigNormalizada
  )
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!sigCanonica) {
    return null;
  }

  const entradaExistente = Object.entries(MAPA_SIG_AGENTE_POR_CODIGO).find(([, sig]) => {
    return normalizarChave(sig) === sigCanonica;
  });

  if (entradaExistente) {
    return entradaExistente[0];
  }

  return `ANEEL_${sigCanonica}`;
}

function resolverCodigoPorSigAgente(sigAgente) {
  return gerarCodigoDistribuidoraPorSigAgente(sigAgente);
}

function resolverSigAgentePorCodigo(codigoDistribuidora) {
  const codigoNormalizado = normalizarChave(codigoDistribuidora);
  const sigMapeada = MAPA_SIG_AGENTE_POR_CODIGO[codigoNormalizado];

  if (sigMapeada) {
    return sigMapeada;
  }

  if (codigoNormalizado.startsWith("ANEEL_")) {
    return codigoNormalizado.replace(/^ANEEL_/, "").replace(/_/g, " ").trim();
  }

  return null;
}

function resolverSigAgentePorNomeDistribuidora(nomeDistribuidora) {
  const nomeNormalizado = normalizarChave(nomeDistribuidora);
  return MAPA_SIG_AGENTE_POR_NOME_DISTRIBUIDORA[nomeNormalizado] || null;
}

module.exports = {
  normalizarChave,
  gerarCodigoDistribuidoraPorSigAgente,
  resolverCodigoPorSigAgente,
  resolverSigAgentePorCodigo,
  resolverSigAgentePorNomeDistribuidora
};
