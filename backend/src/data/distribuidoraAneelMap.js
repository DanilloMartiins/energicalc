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

function resolverSigAgentePorCodigo(codigoDistribuidora) {
  const codigoNormalizado = normalizarChave(codigoDistribuidora);
  return MAPA_SIG_AGENTE_POR_CODIGO[codigoNormalizado] || null;
}

function resolverSigAgentePorNomeDistribuidora(nomeDistribuidora) {
  const nomeNormalizado = normalizarChave(nomeDistribuidora);
  return MAPA_SIG_AGENTE_POR_NOME_DISTRIBUIDORA[nomeNormalizado] || null;
}

module.exports = {
  normalizarChave,
  resolverSigAgentePorCodigo,
  resolverSigAgentePorNomeDistribuidora
};
