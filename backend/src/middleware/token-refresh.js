const oauthService = require('../services/oauth.service');

// Middleware that ensures a valid token exists before hitting Airtable routes
async function ensureValidToken(req, res, next) {
  try {
    req.airtableToken = await oauthService.getValidToken();
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

module.exports = ensureValidToken;
