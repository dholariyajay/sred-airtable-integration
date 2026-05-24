const router = require('express').Router();
const scraperService = require('../services/scraper.service');
const revisionService = require('../services/revision.service');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await scraperService.initiateLogin(email, password);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/mfa', async (req, res) => {
  try {
    const { mfaCode } = req.body;
    if (!mfaCode) {
      return res.status(400).json({ error: 'MFA code required' });
    }
    const result = await scraperService.submitMfaCode(mfaCode);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cookies/status', async (req, res) => {
  try {
    const result = await scraperService.validateCookies();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/scrape', async (req, res) => {
  const { baseId, tableId } = req.body;

  // Return immediately, run in background
  res.json({ message: 'Scraping started', status: 'in_progress' });

  revisionService.scrapeAllRevisionHistory({ baseId, tableId })
    .then(stats => console.log('[scraper] Scrape complete:', JSON.stringify(stats)))
    .catch(err => console.error('[scraper] Scrape failed:', err.message));
});

module.exports = router;
