function logger(req, res, next) {
  const inicio = Date.now();

  res.on("finish", () => {
    const duracaoMs = Date.now() - inicio;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duracaoMs}ms`);
  });

  next();
}

module.exports = logger;
