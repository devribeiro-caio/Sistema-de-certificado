const mongoose = require('mongoose');

const serviceOrderSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true, uppercase: true, trim: true },
  blingId: { type: String, sparse: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  equipment: {
    modelCode: { type: String, required: true, uppercase: true, trim: true },
    modelName: { type: String, trim: true },
    manufacturer: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    description: { type: String, trim: true }
  },
  openedAt: Date,
  source: { type: String, enum: ['BLING', 'MANUAL', 'DEMO'], default: 'MANUAL' },
  rawBling: mongoose.Schema.Types.Mixed
}, { timestamps: true });

module.exports = mongoose.model('ServiceOrder', serviceOrderSchema);
