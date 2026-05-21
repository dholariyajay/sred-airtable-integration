module.exports = {
  AIRTABLE_AUTH_URL: 'https://airtable.com/oauth2/v1/authorize',
  AIRTABLE_TOKEN_URL: 'https://airtable.com/oauth2/v1/token',
  AIRTABLE_API_BASE: 'https://api.airtable.com/v0',

  OAUTH_SCOPES: 'data.records:read schema.bases:read user.email:read',

  // Airtable allows 5 req/sec per base
  RATE_LIMIT_DELAY_MS: 250,
  PAGINATION_PAGE_SIZE: 100,

  // Token refresh buffer — refresh 30s before actual expiry
  TOKEN_REFRESH_BUFFER_MS: 30000,
};
