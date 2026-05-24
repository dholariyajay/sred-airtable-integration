const crypto = require('crypto');
const axios = require('axios');
const { generateCodeVerifier, generateCodeChallenge } = require('../utils/pkce');
const OAuthToken = require('../models/OAuthToken');
const { AIRTABLE_AUTH_URL, AIRTABLE_TOKEN_URL, OAUTH_SCOPES, TOKEN_REFRESH_BUFFER_MS } = require('../config/constants');
const logger = require('../utils/logger');

// keyed by state param, cleaned up after exchange
let pendingAuth = {};

function getAuthorizationUrl() {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  pendingAuth[state] = { codeVerifier, createdAt: Date.now() };

  const params = new URLSearchParams({
    client_id: process.env.AIRTABLE_CLIENT_ID,
    redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
    response_type: 'code',
    scope: OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  });

  // Airtable rejects '+' for spaces, needs '%20'
  const url = `${AIRTABLE_AUTH_URL}?${params.toString().replace(/\+/g, '%20')}`;
  logger.debug('Auth URL:', url);

  return { url, state };
}

async function exchangeCodeForTokens(code, state) {
  const pending = pendingAuth[state];
  if (!pending) {
    throw new Error('Invalid or expired state parameter');
  }

  const credentials = Buffer.from(
    `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
  ).toString('base64');

  // has to be form-urlencoded, not JSON
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
    code_verifier: pending.codeVerifier
  });

  const response = await axios.post(AIRTABLE_TOKEN_URL, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    }
  });

  const { access_token, refresh_token, expires_in } = response.data;

  await OAuthToken.findOneAndUpdate(
    {},
    {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      scope: OAUTH_SCOPES,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );

  delete pendingAuth[state];
  logger.info('tokens stored');

  return { success: true };
}

async function getValidToken() {
  const tokenDoc = await OAuthToken.findOne({});
  if (!tokenDoc) {
    throw new Error('Not connected - go through OAuth flow first');
  }

  // refresh early to avoid mid-request expiry
  if (tokenDoc.expiresAt <= new Date(Date.now() + TOKEN_REFRESH_BUFFER_MS)) {
    return await refreshAccessToken(tokenDoc);
  }

  return tokenDoc.accessToken;
}

async function refreshAccessToken(tokenDoc) {
  const credentials = Buffer.from(
    `${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenDoc.refreshToken
    });

    const response = await axios.post(AIRTABLE_TOKEN_URL, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`
      }
    });

    const { access_token, refresh_token, expires_in } = response.data;

    tokenDoc.accessToken = access_token;
    tokenDoc.refreshToken = refresh_token;
    tokenDoc.expiresAt = new Date(Date.now() + expires_in * 1000);
    tokenDoc.updatedAt = new Date();
    await tokenDoc.save();

    logger.info('token refreshed');
    return access_token;
  } catch (err) {
    /* refresh failed, token is dead */
    logger.error('Token refresh failed:', err.message);
    await OAuthToken.deleteMany({});
    throw new Error('Refresh token expired, need to reconnect');
  }
}

module.exports = { getAuthorizationUrl, exchangeCodeForTokens, getValidToken };
