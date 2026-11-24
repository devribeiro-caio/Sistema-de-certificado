const jwt = require('jsonwebtoken');
const User = require('../models/User');

const jwtSecret = process.env.JWT_SECRET || 'formis-local-development-secret';

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Acesso nao autenticado.' });

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ error: 'Sessao nao encontrada.' });
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'Sessao invalida ou expirada.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Permissao de laboratorio necessaria.' });
  return next();
}

module.exports = { requireAuth, requireAdmin };
