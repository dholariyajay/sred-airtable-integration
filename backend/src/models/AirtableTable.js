const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema({
  airtableId: { type: String, required: true, index: true },
  baseId:     { type: String, required: true, index: true },
  name:       { type: String, required: true },
  fields:     [{ id: String, name: String, type: String, description: String }],
  views:      [{ id: String, name: String, type: String }],
  syncedAt:   { type: Date, default: Date.now }
});

tableSchema.index({ baseId: 1, airtableId: 1 }, { unique: true });

module.exports = mongoose.model('AirtableTable', tableSchema);
