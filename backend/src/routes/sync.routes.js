const router = require('express').Router();
const syncService = require('../services/sync.service');

let syncInProgress = false;
let lastSyncResult = null;

router.post('/sync', async (req, res) => {
  if (syncInProgress) {
    return res.status(409).json({ error: 'Sync already in progress' });
  }

  syncInProgress = true;
  res.json({ message: 'Sync started' });

  // Run in background so we don't block the response
  try {
    lastSyncResult = await syncService.runFullSync();
    lastSyncResult.completedAt = new Date();
  } catch (err) {
    lastSyncResult = { error: err.message, completedAt: new Date() };
  } finally {
    syncInProgress = false;
  }
});

router.get('/sync/status', (req, res) => {
  res.json({
    inProgress: syncInProgress,
    lastResult: lastSyncResult
  });
});

module.exports = router;
