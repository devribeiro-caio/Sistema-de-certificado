const EquipmentModel = require('../models/EquipmentModel');
const CertificateTemplate = require('../models/CertificateTemplate');
const { normalizeOrderNumber } = require('../utils/formatters');

async function templateForModelCode(modelCode) {
  const normalizedCode = normalizeOrderNumber(modelCode);
  const model = await EquipmentModel.findOne({ $or: [{ code: normalizedCode }, { aliases: normalizedCode }], active: true });
  if (!model) return null;
  return CertificateTemplate.findOne({ equipmentModel: model._id, active: true }).populate('equipmentModel');
}

module.exports = { templateForModelCode };
