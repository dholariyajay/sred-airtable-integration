const mongoose = require('mongoose');

const baseSchema = new mongoose.Schema({
  airtableId:      { type: String, required: true, unique: true, index: true },
  name:            { type: String, required: true },
  permissionLevel: { type: String },
  syncedAt:        { type: Date, default: Date.now }
});

module.exports = mongoose.model('Base', baseSchema);
