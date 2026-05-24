const express = require('express');
const cors = require('cors');
const session = require('express-session');
require('dotenv').config();

const { connectDatabase } = require('./config/database');
const errorHandler = require('./middleware/error-handler');
const ensureValidToken = require('./middleware/token-refresh');
const rateLimiter = require('./middleware/rate-limiter');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth.routes');
const syncRoutes = require('./routes/sync.routes');
const scraperRoutes = require('./routes/scraper.routes');
const dataRoutes = require('./routes/data.routes');

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

app.use('/api/auth', authRoutes);
app.use('/api', ensureValidToken, rateLimiter, syncRoutes);
app.use('/api/scraper', scraperRoutes);
app.use('/api/data', ensureValidToken, dataRoutes);

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
