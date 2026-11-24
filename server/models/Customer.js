const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  externalId: { type: String, unique: true, sparse: true, trim: true },
  legalName: { type: String, required: true, trim: true },
  tradeName: { type: String, trim: true },
  document: { type: String, trim: true },
  email: { type: String, lowercase: true, trim: true, index: true },
  phone: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
