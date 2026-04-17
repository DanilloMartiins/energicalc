const express = require("express");
const apiRoutes = require("./routes");
const logger = require("./middlewares/logger");
const errorHandler = require("./middlewares/errorHandler");
const cipController = require("./controllers/cipController");
const { sendSuccess, sendError } = require("./utils/response");

const app = express();

app.use(express.json());
app.use(logger);

app.get("/health", (req, res) => {
  return sendSuccess(res, 200, { status: "ok" });
});

app.get("/cip", cipController.obterCipPorCidade);

app.use("/api", apiRoutes);

app.use((req, res) => {
  return sendError(res, 404, "Rota não encontrada.");
});

app.use(errorHandler);

module.exports = app;
