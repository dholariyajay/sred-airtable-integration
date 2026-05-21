const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const errorHandler = require('./middleware/error-handler');
const logger = require('./utils/logger');

const app = express();

app.use(cors({
  origin: 'http://localhost:4200',
  credentials: true
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'sred-dev-secret',
  resave: false,
  saveUninitialized: false
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

connectDatabase().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
});

module.exports = app;
