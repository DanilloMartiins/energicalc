const distribuidorasService = require("../services/distribuidorasService");
const { sendSuccess, sendError } = require("../utils/response");
const { toNumber, isValidNumber, isPositive } = require("../utils/number");

function paginacaoFoiInformada(page, limit) {
  return page !== undefined || limit !== undefined;
}

function validarPaginacao(page, limit) {
  const pageNumero = toNumber(page === undefined ? 1 : page);
  const limitNumero = toNumber(limit === undefined ? 10 : limit);

  if (!isValidNumber(pageNumero) || !isPositive(pageNumero)) {
    return {
      valida: false,
      mensagem: "page deve ser um numero maior que zero."
    };
  }

  if (!isValidNumber(limitNumero) || !isPositive(limitNumero)) {
    return {
      valida: false,
      mensagem: "limit deve ser um numero maior que zero."
    };
  }

  return {
    valida: true,
    page: pageNumero,
    limit: limitNumero
  };
}

function listarDistribuidoras(req, res, next) {
  try {
    const { uf, nome, page, limit } = req.query;
    const usarPaginacao = paginacaoFoiInformada(page, limit);

    if (usarPaginacao) {
      const validacao = validarPaginacao(page, limit);

      if (!validacao.valida) {
        return sendError(res, 400, validacao.mensagem);
      }

      const distribuidorasPaginadas = distribuidorasService.listarDistribuidoras({
        uf,
        nome,
        page: validacao.page,
        limit: validacao.limit
      });

      return sendSuccess(res, 200, distribuidorasPaginadas);
    }

    const distribuidoras = distribuidorasService.listarDistribuidoras({ uf, nome });
    return sendSuccess(res, 200, distribuidoras);
  } catch (error) {
    return next(error);
  }
}

function resolverDistribuidoraPorCidadeUf(req, res, next) {
  try {
    const cidade = String(req.query.cidade || "").trim();
    const uf = String(req.query.uf || "")
      .trim()
      .toUpperCase();

    if (!cidade || !uf) {
      return sendError(res, 400, "cidade e uf sao obrigatorios para resolver a distribuidora.");
    }

    if (uf.length !== 2) {
      return sendError(res, 400, "uf deve ter 2 caracteres.");
    }

    const distribuidora = distribuidorasService.obterDistribuidoraPorCidadeUf(cidade, uf);

    if (!distribuidora) {
      return sendError(res, 404, "Nao foi possivel identificar distribuidora para cidade/UF.");
    }

    return sendSuccess(res, 200, distribuidora);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  listarDistribuidoras,
  resolverDistribuidoraPorCidadeUf
};
