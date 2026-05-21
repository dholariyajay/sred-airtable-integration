const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  uuid:        { type: String, required: true, index: true },
  issueId:     { type: String, required: true, index: true },
  columnType:  { type: String, required: true, enum: ['status', 'assignee'] },
  oldValue:    { type: String },
  newValue:    { type: String },
  createdDate: { type: Date, required: true },
  authoredBy:  { type: String },
  scrapedAt:   { type: Date, default: Date.now }
});

revisionSchema.index({ issueId: 1, createdDate: -1 });

module.exports = mongoose.model('RevisionHistory', revisionSchema);
