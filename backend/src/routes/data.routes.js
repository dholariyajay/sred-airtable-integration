const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/collections', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const relevant = collections
      .map(c => c.name)
      .filter(name => !name.startsWith('system.') && name !== 'oauthtokens' && name !== 'scrapersessions');

    res.json(relevant);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/collections/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const db = mongoose.connection.db;

    const existing = await db.listCollections({ name }).toArray();
    if (existing.length === 0) {
      return res.status(404).json({ error: `Collection "${name}" not found` });
    }

    const documents = await db.collection(name).find({}).limit(10000).toArray();

    const formatted = documents.map(doc => ({
      ...doc,
      _id: doc._id.toString()
    }));

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
