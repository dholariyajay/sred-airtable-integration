const crypto = require('crypto');

function generateCodeVerifier() {
  // 96 bytes -> ~128 chars base64url (RFC 7636 says 43-128)
  return crypto.randomBytes(96).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

module.exports = { generateCodeVerifier, generateCodeChallenge };
