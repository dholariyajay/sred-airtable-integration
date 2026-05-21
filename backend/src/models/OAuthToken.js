const mongoose = require('mongoose');

const oauthTokenSchema = new mongoose.Schema({
  accessToken:  { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt:    { type: Date, required: true },
  scope:        { type: String },
  createdAt:    { type: Date, default: Date.now },
  updatedAt:    { type: Date, default: Date.now }
});

module.exports = mongoose.model('OAuthToken', oauthTokenSchema);
