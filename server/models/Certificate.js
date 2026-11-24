const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateNumber: { type: String, required: true, unique: true },
  publicCode: { type: String, required: true, unique: true, index: true },
  serviceOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  equipment: { modelCode: String, modelName: String, manufacturer: String, serialNumber: String, description: String },
  templateSnapshot: { title: String, revision: String, templateKey: String, introText: String, measurementConfig: mongoose.Schema.Types.Mixed, measurementFields: [mongoose.Schema.Types.Mixed] },
  measurements: mongoose.Schema.Types.Mixed,
  notes: { type: String, trim: true },
  issuedAt: { type: Date, default: Date.now },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Certificate', certificateSchema);
