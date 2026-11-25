function errorHandler(error, _req, res, _next) {
  console.error(error);
  if (error?.code === 11000) return res.status(409).json({ error: 'Ja existe um cadastro com estes dados.' });
  if (error?.name === 'ValidationError') return res.status(400).json({ error: Object.values(error.errors).map((item) => item.message).join(' ') });
  const statusCode = Number(error?.statusCode);
  if (Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600) {
    return res.status(statusCode).json({ error: error.message || 'Erro na integracao.' });
  }
  return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
}

module.exports = { errorHandler };
