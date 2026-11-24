const mongoose = require('mongoose');

const equipmentModelSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  manufacturer: { type: String, trim: true },
  aliases: [{ type: String, uppercase: true, trim: true }],
  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('EquipmentModel', equipmentModelSchema);
