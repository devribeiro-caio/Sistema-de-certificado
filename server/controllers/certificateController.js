const crypto = require('crypto');
const Certificate = require('../models/Certificate');
const ServiceOrder = require('../models/ServiceOrder');
const { templateForModelCode } = require('../services/templateService');
const { certificateScope, normalizeOrderNumber } = require('../utils/formatters');
const { streamCertificatePdf } = require('../utils/certificatePdf');

async function listCertificates(req, res, next) {
  try { return res.json(await Certificate.find(certificateScope(req.user)).sort({ issuedAt: -1 }).populate('customer serviceOrder')); } catch (error) { return next(error); }
}

async function issueCertificate(req, res, next) {
  try {
    const order = await ServiceOrder.findOne({ number: normalizeOrderNumber(req.body.orderNumber) }).populate('customer');
    if (!order) return res.status(404).json({ error: 'OS nao encontrada.' });
    const template = await templateForModelCode(order.equipment.modelCode);
    if (!template) return res.status(422).json({ error: `Nao existe certificado cadastrado para o modelo ${order.equipment.modelCode}.` });
    const missing = template.measurementFields.filter((field) => field.required && !String(req.body.measurements?.[field.key] || '').trim());
    if (missing.length) return res.status(400).json({ error: `Preencha: ${missing.map((field) => field.label).join(', ')}.` });
    const edits = req.body.orderEdits || {};
    const equipment = {
      modelCode: String(edits.modelCode || order.equipment.modelCode).trim().toUpperCase(),
      modelName: String(edits.modelName || order.equipment.modelName || '').trim(),
      manufacturer: String(edits.manufacturer || order.equipment.manufacturer || '').trim(),
      serialNumber: String(edits.serialNumber || order.equipment.serialNumber || '').trim(),
      description: String(edits.description || order.equipment.description || '').trim()
    };
    const year = new Date().getFullYear();
    const sequence = String((await Certificate.countDocuments({ issuedAt: { $gte: new Date(`${year}-01-01`) } })) + 1).padStart(5, '0');
    const certificate = await Certificate.create({
      certificateNumber: `FOR-${year}-${sequence}`,
      publicCode: crypto.randomBytes(7).toString('hex').toUpperCase(),
      serviceOrder: order._id,
      customer: order.customer._id,
      equipment,
      templateSnapshot: { title: template.title, revision: template.revision, templateKey: template.templateKey, introText: template.introText, measurementConfig: template.measurementConfig, measurementFields: template.measurementFields },
      measurements: req.body.measurements || {},
      notes: req.body.notes || '',
      issuedBy: req.user._id
    });
    return res.status(201).json(await certificate.populate('customer serviceOrder'));
  } catch (error) { return next(error); }
}

async function findCertificate(id, user) {
  return Certificate.findOne({ _id: id, ...certificateScope(user) }).populate('customer serviceOrder issuedBy');
}

async function getCertificate(req, res, next) {
  try {
    const certificate = await findCertificate(req.params.id, req.user);
    if (!certificate) return res.status(404).json({ error: 'Certificado nao encontrado.' });
    return res.json(certificate);
  } catch (error) { return next(error); }
}

async function downloadCertificatePdf(req, res, next) {
  try {
    const certificate = await findCertificate(req.params.id, req.user);
    if (!certificate) return res.status(404).json({ error: 'Certificado nao encontrado.' });
    return streamCertificatePdf(certificate, res);
  } catch (error) { return next(error); }
}

module.exports = { downloadCertificatePdf, getCertificate, issueCertificate, listCertificates };
