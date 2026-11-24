require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 3333);
const jwtSecret = process.env.JWT_SECRET || 'formis-local-development-secret';

mongoose.set('bufferCommands', false);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'CLIENT'], default: 'CLIENT' },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  externalId: { type: String, unique: true, sparse: true, trim: true },
  legalName: { type: String, required: true, trim: true },
  tradeName: { type: String, trim: true },
  document: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true }
}, { timestamps: true });

const equipmentModelSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  manufacturer: { type: String, trim: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const templateSchema = new mongoose.Schema({
  equipmentModel: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentModel', required: true, unique: true },
  title: { type: String, required: true, trim: true },
  revision: { type: String, required: true, trim: true },
  introText: { type: String, default: 'Certificamos que o instrumento descrito foi avaliado conforme os procedimentos aplicaveis do laboratorio Formis.' },
  measurementFields: [{
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    required: { type: Boolean, default: false }
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

const serviceOrderSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  blingId: { type: String, sparse: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  equipment: {
    modelCode: { type: String, required: true, uppercase: true, trim: true },
    modelName: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  openedAt: Date,
  source: { type: String, enum: ['BLING', 'MANUAL', 'DEMO'], default: 'MANUAL' },
  rawBling: mongoose.Schema.Types.Mixed
}, { timestamps: true });

const certificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true },
  publicCode: { type: String, required: true, unique: true, index: true },
  serviceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  equipment: { modelCode: String, modelName: String, serialNumber: String, description: String },
  templateSnapshot: { title: String, revision: String, introText: String, measurementFields: [mongoose.Schema.Types.Mixed] },
  measurements: mongoose.Schema.Types.Mixed,
  notes: { type: String, trim: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);
const Customer = mongoose.model('Customer', customerSchema);
const EquipmentModel = mongoose.model('EquipmentModel', equipmentModelSchema);
const CertificateTemplate = mongoose.model('CertificateTemplate', templateSchema);
const ServiceOrder = mongoose.model('ServiceOrder', serviceOrderSchema);
const Certificate = mongoose.model('Certificate', certificateSchema);

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, customer: user.customer };
}

function tokenFor(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, { expiresIn: '8h' });
}

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Acesso nao autenticado.' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ error: 'Sessao nao encontrada.' });
    next();
  } catch (_) { return res.status(401).json({ error: 'Sessao invalida ou expirada.' }); }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Permissao de laboratorio necessaria.' });
  next();
}

function normalized(value) { return String(value || '').trim().toUpperCase(); }
function certificateScope(user) { return user.role === 'CLIENT' ? { customer: user.customer } : {}; }

async function seedDatabase() {
  const email = String(process.env.ADMIN_EMAIL || 'lab@formis.com.br').toLowerCase();
  if (process.env.ADMIN_PASSWORD && !await User.findOne({ email })) {
    await User.create({ name: 'Laboratorio Formis', email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'ADMIN' });
    console.log('Administrador inicial criado.');
  }
  const customer = await Customer.findOneAndUpdate(
    { externalId: 'DEMO-001' },
    { $setOnInsert: { legalName: 'Cliente demonstracao Formis', tradeName: 'Cliente Demo', email: 'cliente@formis.demo', document: '00.000.000/0001-00' } },
    { new: true, upsert: true }
  );
  const model = await EquipmentModel.findOneAndUpdate(
    { code: 'FOR-550' }, { $setOnInsert: { name: 'Termometro infravermelho FOR-550', manufacturer: 'Formis' } }, { new: true, upsert: true }
  );
  await CertificateTemplate.findOneAndUpdate(
    { equipmentModel: model._id },
    { $setOnInsert: { title: 'Certificado de Calibracao - FOR-550', revision: 'REV. 01', measurementFields: [
      { key: 'range', label: 'Faixa avaliada', unit: 'C', required: true },
      { key: 'reference', label: 'Padrao de referencia', unit: '', required: true },
      { key: 'result', label: 'Resultado', unit: 'C', required: true },
      { key: 'uncertainty', label: 'Incerteza', unit: 'C', required: true }
    ] } }, { upsert: true }
  );
  await ServiceOrder.findOneAndUpdate(
    { number: 'OS-2026-0001' },
    { $setOnInsert: { customer: customer._id, equipment: { modelCode: 'FOR-550', modelName: model.name, serialNumber: 'FOR550-0001', description: 'Termometro infravermelho para calibracao' }, openedAt: new Date(), source: 'DEMO' } },
    { upsert: true }
  );
}

function mapBlingOrder(payload, requestedNumber) {
  const source = payload?.data || payload;
  const customer = source?.cliente || source?.contato || {};
  const items = source?.itens || source?.equipamentos || [];
  const item = Array.isArray(items) ? items[0] || {} : items;
  return {
    number: normalized(source?.numero || source?.numeroOrdem || requestedNumber), blingId: String(source?.id || ''),
    customer: { externalId: String(customer?.id || customer?.codigo || ''), legalName: customer?.nome || customer?.razaoSocial || 'Cliente sem nome', tradeName: customer?.fantasia || '', document: customer?.numeroDocumento || customer?.cnpj || customer?.cpf || '', email: customer?.email || '', phone: customer?.telefone || '' },
    equipment: { modelCode: item?.codigo || item?.modelo || source?.modelo || '', modelName: item?.descricao || item?.nome || source?.descricao || '', serialNumber: item?.numeroSerie || item?.serie || source?.numeroSerie || '', description: item?.descricao || source?.observacoes || '' },
    openedAt: source?.data || source?.dataAbertura || new Date(), rawBling: source
  };
}

async function cacheMappedOrder(mapped, source = 'BLING') {
  if (!mapped.number || !mapped.equipment.modelCode) throw new Error('A OS recebida nao possui numero ou modelo do equipamento.');
  const customerQuery = mapped.customer.externalId ? { externalId: mapped.customer.externalId } : { email: mapped.customer.email };
  const customer = await Customer.findOneAndUpdate(customerQuery, { $set: mapped.customer }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return ServiceOrder.findOneAndUpdate(
    { number: mapped.number },
    { $set: { blingId: mapped.blingId, customer: customer._id, equipment: mapped.equipment, openedAt: mapped.openedAt, rawBling: mapped.rawBling, source } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

async function resolveServiceOrder(number) {
  const cached = await ServiceOrder.findOne({ number: normalized(number) }).populate('customer');
  if (cached) return cached;
  if (!process.env.BLING_ACCESS_TOKEN) return null;
  const path = (process.env.BLING_SERVICE_ORDER_PATH || '/servicos/ordens/{number}').replace('{number}', encodeURIComponent(normalized(number)));
  const response = await axios.get(`${process.env.BLING_BASE_URL || 'https://api.bling.com.br/Api/v3'}${path}`, { headers: { Authorization: `Bearer ${process.env.BLING_ACCESS_TOKEN}` }, timeout: 10000 });
  return (await cacheMappedOrder(mapBlingOrder(response.data, number))).populate('customer');
}

async function templateForCode(modelCode) {
  const model = await EquipmentModel.findOne({ code: normalized(modelCode), active: true });
  return model ? CertificateTemplate.findOne({ equipmentModel: model._id, active: true }).populate('equipmentModel') : null;
}

app.get('/api/health', (_, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || '').trim().toLowerCase() });
    if (!user || !await bcrypt.compare(String(req.body.password || ''), user.passwordHash)) return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!name || !email || password.length < 8) return res.status(400).json({ error: 'Informe nome, e-mail e uma senha de pelo menos 8 caracteres.' });
    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(404).json({ error: 'Este e-mail ainda nao esta vinculado a um cliente importado do Bling.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'Ja existe uma conta para este e-mail.' });
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'CLIENT', customer: customer._id });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const scope = certificateScope(req.user);
    const [certificates, recent, templates, orders] = await Promise.all([
      Certificate.countDocuments(scope), Certificate.find(scope).sort({ issuedAt: -1 }).limit(5).populate('customer serviceOrder'),
      req.user.role === 'ADMIN' ? CertificateTemplate.countDocuments({ active: true }) : 0,
      req.user.role === 'ADMIN' ? ServiceOrder.countDocuments() : 0
    ]);
    res.json({ certificates, templates, orders, recent });
  } catch (error) { next(error); }
});

app.get('/api/equipment-models', requireAuth, async (_, res, next) => { try { res.json(await EquipmentModel.find().sort({ code: 1 })); } catch (error) { next(error); } });
app.post('/api/equipment-models', requireAuth, requireAdmin, async (req, res, next) => { try { res.status(201).json(await EquipmentModel.create({ code: req.body.code, name: req.body.name, manufacturer: req.body.manufacturer })); } catch (error) { next(error); } });
app.get('/api/templates', requireAuth, requireAdmin, async (_, res, next) => { try { res.json(await CertificateTemplate.find().populate('equipmentModel').sort({ updatedAt: -1 })); } catch (error) { next(error); } });
app.post('/api/templates', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { equipmentModel, title, revision, introText, measurementFields } = req.body;
    if (!equipmentModel || !title || !revision) return res.status(400).json({ error: 'Modelo, titulo e revisao sao obrigatorios.' });
    const template = await CertificateTemplate.findOneAndUpdate({ equipmentModel }, { $set: { title, revision, introText, measurementFields: Array.isArray(measurementFields) ? measurementFields : [], active: true } }, { new: true, upsert: true, runValidators: true }).populate('equipmentModel');
    res.status(201).json(template);
  } catch (error) { next(error); }
});
app.get('/api/customers', requireAuth, requireAdmin, async (_, res, next) => { try { res.json(await Customer.find().sort({ legalName: 1 })); } catch (error) { next(error); } });

app.get('/api/service-orders/:number', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const order = await resolveServiceOrder(req.params.number);
    if (!order) return res.status(404).json({ error: 'OS nao encontrada. Sincronize a OS pelo Bling ou confira o numero informado.' });
    const template = await templateForCode(order.equipment.modelCode);
    if (!template) return res.status(422).json({ error: `Nao existe modelo de certificado ativo para ${order.equipment.modelCode}.` });
    res.json({ order, template });
  } catch (error) { next(error); }
});

app.post('/api/bling/orders/sync', requireAuth, requireAdmin, async (req, res, next) => {
  try { res.status(201).json(await (await cacheMappedOrder(mapBlingOrder(req.body, req.body.number), 'MANUAL')).populate('customer')); } catch (error) { next(error); }
});

app.get('/api/certificates', requireAuth, async (req, res, next) => { try { res.json(await Certificate.find(certificateScope(req.user)).sort({ issuedAt: -1 }).populate('customer serviceOrder')); } catch (error) { next(error); } });

app.post('/api/certificates', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const order = await ServiceOrder.findOne({ number: normalized(req.body.orderNumber) }).populate('customer');
    if (!order) return res.status(404).json({ error: 'OS nao encontrada.' });
    const template = await templateForCode(order.equipment.modelCode);
    if (!template) return res.status(422).json({ error: `Nao existe certificado cadastrado para o modelo ${order.equipment.modelCode}.` });
    const missing = template.measurementFields.filter((field) => field.required && !String(req.body.measurements?.[field.key] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Preencha: ${missing.map((field) => field.label).join(', ')}.` });
    const year = new Date().getFullYear();
    const sequence = String((await Certificate.countDocuments({ issuedAt: { $gte: new Date(`${year}-01-01`) } })) + 1).padStart(5, '0');
    const certificate = await Certificate.create({
      certificateNumber: `FOR-${year}-${sequence}`, publicCode: crypto.randomBytes(7).toString('hex').toUpperCase(), serviceOrder: order._id, customer: order.customer._id,
      equipment: order.equipment, templateSnapshot: { title: template.title, revision: template.revision, introText: template.introText, measurementFields: template.measurementFields }, measurements: req.body.measurements || {}, notes: req.body.notes || '', issuedBy: req.user._id
    });
    res.status(201).json(await certificate.populate('customer serviceOrder'));
  } catch (error) { next(error); }
});

async function certificateForUser(id, user) { return Certificate.findOne({ _id: id, ...certificateScope(user) }).populate('customer serviceOrder issuedBy'); }
app.get('/api/certificates/:id', requireAuth, async (req, res, next) => { try { const certificate = await certificateForUser(req.params.id, req.user); if (!certificate) return res.status(404).json({ error: 'Certificado nao encontrado.' }); res.json(certificate); } catch (error) { next(error); } });
app.get('/api/certificates/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const certificate = await certificateForUser(req.params.id, req.user);
    if (!certificate) return res.status(404).json({ error: 'Certificado nao encontrado.' });
    const document = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `inline; filename=${certificate.certificateNumber}.pdf`); document.pipe(res);
    document.fillColor('#10252d').fontSize(20).text('FORMIS', { continued: true }).fillColor('#e45435').text(' CERTIFICA');
    document.moveDown(.4).fillColor('#10252d').fontSize(15).text(certificate.templateSnapshot.title);
    document.fontSize(9).fillColor('#4b5b62').text(`Certificado: ${certificate.certificateNumber}  |  Revisao: ${certificate.templateSnapshot.revision}`);
    document.moveDown().strokeColor('#d5dde0').moveTo(50, document.y).lineTo(545, document.y).stroke().moveDown();
    document.fillColor('#10252d').fontSize(11).text('IDENTIFICACAO').fontSize(10).fillColor('#26363d');
    document.text(`Cliente: ${certificate.customer.legalName}`).text(`Ordem de servico: ${certificate.serviceOrder.number}`).text(`Equipamento: ${certificate.equipment.modelName || certificate.equipment.modelCode}`).text(`Modelo: ${certificate.equipment.modelCode}    Serie: ${certificate.equipment.serialNumber || 'Nao informada'}`);
    document.moveDown().text(certificate.templateSnapshot.introText).moveDown().fillColor('#10252d').fontSize(11).text('RESULTADOS').moveDown(.4);
    certificate.templateSnapshot.measurementFields.forEach((field) => document.fontSize(10).fillColor('#26363d').text(`${field.label}: ${certificate.measurements?.[field.key] || '-'}${field.unit ? ` ${field.unit}` : ''}`));
    if (certificate.notes) document.moveDown().text(`Observacoes: ${certificate.notes}`);
    document.moveDown(2).strokeColor('#d5dde0').moveTo(50, document.y).lineTo(260, document.y).stroke().moveDown(.25).fontSize(9).fillColor('#4b5b62').text('Laboratorio Formis Instrumentos de Medicao').text(`Emissao: ${new Intl.DateTimeFormat('pt-BR').format(certificate.issuedAt)}`).moveDown().fontSize(8).text(`Codigo de verificacao: ${certificate.publicCode}`);
    document.end();
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error?.code === 11000) return res.status(409).json({ error: 'Ja existe um cadastro com estes dados.' });
  if (error?.name === 'ValidationError') return res.status(400).json({ error: Object.values(error.errors).map((item) => item.message).join(' ') });
  return res.status(500).json({ error: error.message || 'Erro interno do servidor.' });
});

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/formis-certificados').then(async () => { console.log('MongoDB conectado.'); await seedDatabase(); }).catch((error) => console.error(`MongoDB indisponivel: ${error.message}`));
app.listen(port, () => console.log(`API Formis Certifica em http://localhost:${port}`));
