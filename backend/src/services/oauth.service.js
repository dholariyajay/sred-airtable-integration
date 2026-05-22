const crypto = require('crypto');
const axios = require('axios');
const { generateCodeVerifier, generateCodeChallenge } = require('../utils/pkce');
const OAuthToken = require('../models/OAuthToken');
const { AIRTABLE_AUTH_URL, AIRTABLE_TOKEN_URL, OAUTH_SCOPES, TOKEN_REFRESH_BUFFER_MS } = require('../config/constants');
const logger = require('../utils/logger');

// In-memory store for PKCE verifiers keyed by state
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

  // URLSearchParams encodes spaces as '+', but Airtable needs '%20'
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

  const response = await axios.post(AIRTABLE_TOKEN_URL, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.AIRTABLE_REDIRECT_URI,
    code_verifier: pending.codeVerifier
  }, {
    headers: {
      'Content-Type': 'application/json',
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
  logger.info('OAuth tokens stored successfully');

  return { success: true };
}

async function getValidToken() {
  const tokenDoc = await OAuthToken.findOne({});
  if (!tokenDoc) {
    throw new Error('No OAuth token found. Please connect Airtable first.');
  }

  // Refresh if expired or about to expire
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
    const response = await axios.post(AIRTABLE_TOKEN_URL, {
      grant_type: 'refresh_token',
      refresh_token: tokenDoc.refreshToken
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`
      }
    });

    const { access_token, refresh_token, expires_in } = response.data;

    tokenDoc.accessToken = access_token;
    tokenDoc.refreshToken = refresh_token;
    tokenDoc.expiresAt = new Date(Date.now() + expires_in * 1000);
    tokenDoc.updatedAt = new Date();
    await tokenDoc.save();

    logger.info('Token refreshed successfully');
    return access_token;
  } catch (err) {
    /* If refresh fails, token is dead — user needs to reconnect */
    logger.error('Token refresh failed:', err.message);
    await OAuthToken.deleteMany({});
    throw new Error('Token refresh failed. Please reconnect Airtable.');
  }
}

module.exports = { getAuthorizationUrl, exchangeCodeForTokens, getValidToken };
