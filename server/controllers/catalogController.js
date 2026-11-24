const Customer = require('../models/Customer');
const EquipmentModel = require('../models/EquipmentModel');
const CertificateTemplate = require('../models/CertificateTemplate');

async function listModels(_req, res, next) { try { return res.json(await EquipmentModel.find().sort({ code: 1 })); } catch (error) { return next(error); } }
async function createModel(req, res, next) { try { return res.status(201).json(await EquipmentModel.create({ code: req.body.code, name: req.body.name, manufacturer: req.body.manufacturer })); } catch (error) { return next(error); } }
async function listTemplates(_req, res, next) { try { return res.json(await CertificateTemplate.find().populate('equipmentModel').sort({ updatedAt: -1 })); } catch (error) { return next(error); } }
async function listCustomers(_req, res, next) { try { return res.json(await Customer.find().sort({ legalName: 1 })); } catch (error) { return next(error); } }

async function saveTemplate(req, res, next) {
  try {
    const { equipmentModel, title, revision, introText, measurementFields } = req.body;
    if (!equipmentModel || !title || !revision) return res.status(400).json({ error: 'Modelo, titulo e revisao sao obrigatorios.' });
    const template = await CertificateTemplate.findOneAndUpdate(
      { equipmentModel },
      { $set: { title, revision, introText, measurementFields: Array.isArray(measurementFields) ? measurementFields : [], active: true } },
      { new: true, upsert: true, runValidators: true }
    ).populate('equipmentModel');
    return res.status(201).json(template);
  } catch (error) { return next(error); }
}

module.exports = { createModel, listCustomers, listModels, listTemplates, saveTemplate };
