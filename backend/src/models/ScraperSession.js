const mongoose = require('mongoose');

const scraperSessionSchema = new mongoose.Schema({
  cookies:       [{ name: String, value: String, domain: String, path: String, expires: Number }],
  isValid:       { type: Boolean, default: true },
  mfaRequired:   { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
  lastValidated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScraperSession', scraperSessionSchema);
