const mongoose = require('mongoose');

const blingOAuthTokenSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'bling' },
  accessTokenCiphertext: { type: String, required: true },
  refreshTokenCiphertext: { type: String, default: '' },
  expiresAt: { type: Date, default: null },
  tokenType: { type: String, default: 'Bearer' }
}, { timestamps: true });

module.exports = mongoose.models.BlingOAuthToken || mongoose.model('BlingOAuthToken', blingOAuthTokenSchema);
