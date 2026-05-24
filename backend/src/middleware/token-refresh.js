const oauthService = require('../services/oauth.service');

// bail early if we don't have a valid token
async function ensureValidToken(req, res, next) {
  try {
    req.airtableToken = await oauthService.getValidToken();
    next();
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

module.exports = ensureValidToken;
