const mongoose = require('mongoose');

const certificateTemplateSchema = new mongoose.Schema({
  equipmentModel: { type: mongoose.Schema.Types.ObjectId, ref: 'EquipmentModel', required: true, unique: true },
  title: { type: String, required: true, trim: true },
  revision: { type: String, required: true, trim: true },
  templateKey: { type: String, trim: true },
  sourceWorkbook: { type: String, trim: true },
  sourceDirectory: { type: String, trim: true },
  importStatus: { type: String, enum: ['READY', 'PENDING_MAPPING'], default: 'READY' },
  measurementConfig: { type: mongoose.Schema.Types.Mixed },
  introText: { type: String, default: 'Certificamos que o instrumento descrito foi avaliado conforme os procedimentos aplicaveis do laboratorio Formis.' },
  measurementFields: [{
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    required: { type: Boolean, default: false }
  }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CertificateTemplate', certificateTemplateSchema);
