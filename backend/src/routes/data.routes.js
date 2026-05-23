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

    // Verify collection exists
    const existing = await db.listCollections({ name }).toArray();
    if (existing.length === 0) {
      return res.status(404).json({ error: `Collection "${name}" not found` });
    }

    const documents = await db.collection(name).find({}).limit(10000).toArray();

    // Flatten for AG Grid — _id to string, nested fields to top-level keys
    const flattened = documents.map(doc => {
      const flat = { ...doc };
      if (flat._id) flat._id = flat._id.toString();

      // Flatten nested 'fields' object so each field becomes a column in AG Grid
      if (flat.fields && typeof flat.fields === 'object') {
        Object.entries(flat.fields).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            flat[key] = value.map(v => typeof v === 'object' ? (v.name || v.email || JSON.stringify(v)) : v).join(', ');
          } else if (value && typeof value === 'object') {
            flat[key] = value.name || value.email || JSON.stringify(value);
          } else {
            flat[key] = value;
          }
        });
        delete flat.fields;
      }
      return flat;
    });

    res.json(flattened);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
