const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sred-airtable';

  try {
    await mongoose.connect(uri);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected — attempting reconnect');
  });
}

module.exports = { connectDatabase };
