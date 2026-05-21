const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  airtableUserId: { type: String, required: true, unique: true, index: true },
  email:          { type: String },
  name:           { type: String },
  state:          { type: String },
  syncedAt:       { type: Date, default: Date.now }
});

module.exports = mongoose.model('AirtableUser', userSchema);
