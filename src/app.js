const express = require("express");
const apiRoutes = require("./routes");

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiRoutes);

app.use((req, res) => {
  res.status(404).json({ erro: "Rota nao encontrada." });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ erro: "JSON invalido no corpo da requisicao." });
  }

  return res.status(500).json({ erro: "Erro interno do servidor." });
});

module.exports = app;
