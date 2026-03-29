const express = require("express");
const distribuidorasController = require("../controllers/distribuidorasController");
const bandeiraController = require("../controllers/bandeiraController");
const calculoController = require("../controllers/calculoController");

const router = express.Router();

router.get("/distribuidoras", distribuidorasController.listarDistribuidoras);
router.get("/bandeira", bandeiraController.obterBandeiraAtual);
router.get("/calculo", calculoController.calcular);

module.exports = router;
