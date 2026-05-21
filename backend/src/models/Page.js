const mongoose = require('mongoose');

// Separate collection — the assessment explicitly requires this
const pageSchema = new mongoose.Schema({
  airtableRecordId: { type: String, required: true, index: true },
  baseId:           { type: String, required: true, index: true },
  tableId:          { type: String, required: true, index: true },
  fields:           { type: mongoose.Schema.Types.Mixed },
  createdTime:      { type: Date },
  syncedAt:         { type: Date, default: Date.now }
});

pageSchema.index({ baseId: 1, tableId: 1, airtableRecordId: 1 }, { unique: true });

module.exports = mongoose.model('Page', pageSchema);
