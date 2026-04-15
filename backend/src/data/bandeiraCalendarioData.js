const calendarioOficial = require("./bandeiraCalendarioOficial.json");

function ehDataIsoValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || "").trim());
}

function toChaveDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function parseAnoMes(anoMes) {
  const texto = String(anoMes || "").trim();
  const match = texto.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const ano = Number(match[1]);
  const mes = Number(match[2]);

  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 1 || mes > 12) {
    return null;
  }

  return { ano, mes };
}

function normalizarPublicacoes(publicacoes) {
  if (!Array.isArray(publicacoes)) {
    return [];
  }

  return publicacoes
    .map((item) => {
      const dataPublicacao = String(item && item.dataPublicacao ? item.dataPublicacao : "").trim();
      const mesVigencia = String(item && item.mesVigencia ? item.mesVigencia : "").trim();

      if (!ehDataIsoValida(dataPublicacao) || !parseAnoMes(mesVigencia)) {
        return null;
      }

      return {
        dataPublicacao,
        mesVigencia
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dataPublicacao.localeCompare(b.dataPublicacao));
}

function toTimestampInicioDiaLocal(dataIso) {
  const partes = String(dataIso).split("-");
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  return new Date(ano, mes - 1, dia).getTime();
}

const PUBLICACOES_NORMALIZADAS = normalizarPublicacoes(calendarioOficial.publicacoes);

function listarPublicacoesOficiais() {
  return PUBLICACOES_NORMALIZADAS.map((item) => ({ ...item }));
}

function obterUltimaPublicacaoAte(dataReferencia = new Date()) {
  const chaveAtual = toChaveDataLocal(dataReferencia);

  for (let i = PUBLICACOES_NORMALIZADAS.length - 1; i >= 0; i -= 1) {
    const publicacao = PUBLICACOES_NORMALIZADAS[i];
    if (publicacao.dataPublicacao <= chaveAtual) {
      return {
        ...publicacao,
        timestampInicioDia: toTimestampInicioDiaLocal(publicacao.dataPublicacao)
      };
    }
  }

  return null;
}

module.exports = {
  listarPublicacoesOficiais,
  obterUltimaPublicacaoAte,
  __internals: {
    ehDataIsoValida,
    parseAnoMes,
    normalizarPublicacoes,
    toChaveDataLocal,
    toTimestampInicioDiaLocal
  }
};

