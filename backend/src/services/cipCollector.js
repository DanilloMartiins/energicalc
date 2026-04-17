const BASE_LEIS_MUNICIPAIS_URL = "https://leismunicipais.com.br";

function montarConsultas(cidade, uf) {
  const cidadeLimpa = String(cidade || "").trim();
  const ufLimpa = String(uf || "").trim().toUpperCase();

  return [
    `CIP iluminação pública ${cidadeLimpa} ${ufLimpa}`,
    `COSIP ${cidadeLimpa} ${ufLimpa}`,
    `contribuição iluminação pública ${cidadeLimpa} ${ufLimpa}`
  ];
}

function montarUrlsBusca(cidade, uf) {
  return montarConsultas(cidade, uf).map((consulta) => {
    return `${BASE_LEIS_MUNICIPAIS_URL}/?s=${encodeURIComponent(consulta)}`;
  });
}

function limparHtmlParaTexto(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairLinksDaBusca(html) {
  const texto = String(html || "");
  const regex = /href=["']([^"']+)["']/gi;
  const links = new Set();
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const href = String(match[1] || "").trim();
    if (!href) {
      continue;
    }

    if (!href.includes("leismunicipais.com.br")) {
      continue;
    }

    if (/\/\?s=|\/wp-|\/tag\/|\/categoria\//i.test(href)) {
      continue;
    }

    links.add(href.startsWith("http") ? href : `${BASE_LEIS_MUNICIPAIS_URL}${href}`);
  }

  return Array.from(links);
}

async function fetchComTimeout(url, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Falha ao consultar URL: ${url}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function coletarFontesCip({ cidade, uf, fetchImpl = fetch, timeoutMs = 12000, maxUrls = 6 }) {
  const urlsBusca = montarUrlsBusca(cidade, uf);
  const linksEncontrados = new Set();

  for (const urlBusca of urlsBusca) {
    try {
      const htmlBusca = await fetchComTimeout(urlBusca, timeoutMs, fetchImpl);
      const links = extrairLinksDaBusca(htmlBusca);

      links.forEach((link) => {
        if (linksEncontrados.size < maxUrls) {
          linksEncontrados.add(link);
        }
      });
    } catch (error) {
      // Coleta incremental: ignora falha pontual de uma busca e tenta as demais.
    }
  }

  const resultados = [];
  for (const link of linksEncontrados) {
    try {
      const htmlDetalhe = await fetchComTimeout(link, timeoutMs, fetchImpl);
      resultados.push({
        fonte: link,
        textoLegislacao: limparHtmlParaTexto(htmlDetalhe)
      });
    } catch (error) {
      // Mantemos estratégia resiliente sem interromper toda a coleta.
    }
  }

  return resultados;
}

module.exports = {
  montarConsultas,
  montarUrlsBusca,
  coletarFontesCip,
  __internals: {
    limparHtmlParaTexto,
    extrairLinksDaBusca
  }
};
