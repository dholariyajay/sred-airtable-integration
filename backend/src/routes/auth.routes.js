const router = require('express').Router();
const oauthService = require('../services/oauth.service');

router.get('/connect', (req, res) => {
  const { url } = oauthService.getAuthorizationUrl();
  res.redirect(url);
});

router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    await oauthService.exchangeCodeForTokens(code, state);
    res.redirect('http://localhost:4200?auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.redirect('http://localhost:4200?auth=failed');
  }
});

router.get('/status', async (req, res) => {
  try {
    await oauthService.getValidToken();
    res.json({ connected: true });
  } catch {
    res.json({ connected: false });
  }
});

module.exports = router;
