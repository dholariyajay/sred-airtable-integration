const crypto = require('crypto');

function generateCodeVerifier() {
  // 128 random bytes → base64url (spec says 43-128 chars)
  return crypto.randomBytes(96).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

module.exports = { generateCodeVerifier, generateCodeChallenge };
