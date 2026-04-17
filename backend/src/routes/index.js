const express = require("express");
const distribuidorasController = require("../controllers/distribuidorasController");
const bandeiraController = require("../controllers/bandeiraController");
const calculoController = require("../controllers/calculoController");
const tarifasController = require("../controllers/tarifasController");
const impostosController = require("../controllers/impostosController");
const cipController = require("../controllers/cipController");

const router = express.Router();

router.get("/distribuidoras", distribuidorasController.listarDistribuidoras);
router.get(
  "/distribuidoras/resolver",
  distribuidorasController.resolverDistribuidoraPorCidadeUf
);
router.get("/bandeira", bandeiraController.obterBandeiraAtual);
router.get("/tarifas", tarifasController.listarTarifas);
router.get("/impostos", impostosController.listarImpostos);
router.get("/cip", cipController.obterCipPorCidade);
router.get("/calculo", calculoController.calcular);
router.post("/calculo", calculoController.calcularPost);

module.exports = router;
