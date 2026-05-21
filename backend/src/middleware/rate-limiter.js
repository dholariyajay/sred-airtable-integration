const { RATE_LIMIT_DELAY_MS } = require('../config/constants');

// Simple in-memory rate limiter for Airtable API (5 req/sec per base)
let lastRequestTime = 0;

async function rateLimiter(req, res, next) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;

  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - elapsed));
  }

  lastRequestTime = Date.now();
  next();
}

module.exports = rateLimiter;
