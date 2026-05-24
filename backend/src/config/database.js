const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sred-airtable';

  try {
    await mongoose.connect(uri);
    logger.info('db connected');
  } catch (err) {
    logger.error('mongo connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('mongo error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo disconnected');
  });
}

module.exports = { connectDatabase };
