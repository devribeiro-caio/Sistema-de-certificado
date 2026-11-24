const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');

const jwtSecret = process.env.JWT_SECRET || 'formis-local-development-secret';
const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role, customer: user.customer });
const tokenFor = (user) => jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, { expiresIn: '8h' });

async function login(req, res, next) {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
    if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    return res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { return next(error); }
}

async function registerClient(req, res, next) {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Informe nome, e-mail e uma senha de pelo menos 8 caracteres.' });
    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(404).json({ error: 'Este e-mail ainda nao esta vinculado a um cliente importado do Bling.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'Ja existe uma conta para este e-mail.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'CLIENT', customer: customer._id });
    return res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { return next(error); }
}

function currentUser(req, res) { return res.json({ user: publicUser(req.user) }); }

module.exports = { currentUser, login, registerClient };
