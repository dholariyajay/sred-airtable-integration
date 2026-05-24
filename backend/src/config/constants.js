module.exports = {
  AIRTABLE_AUTH_URL: 'https://airtable.com/oauth2/v1/authorize',
  AIRTABLE_TOKEN_URL: 'https://airtable.com/oauth2/v1/token',
  AIRTABLE_API_BASE: 'https://api.airtable.com/v0',

  OAUTH_SCOPES: 'data.records:read schema.bases:read user.email:read',

  RATE_LIMIT_DELAY_MS: 250,   // 5 req/sec
  PAGINATION_PAGE_SIZE: 100,

  TOKEN_REFRESH_BUFFER_MS: 30000,  // refresh 30s before expiry
};
