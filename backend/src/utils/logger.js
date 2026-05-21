const prefix = (level) => `[${level}] ${new Date().toISOString()}`;

const logger = {
  info: (...args) => console.log(prefix('info'), ...args),
  warn: (...args) => console.warn(prefix('warn'), ...args),
  error: (...args) => console.error(prefix('error'), ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(prefix('debug'), ...args);
    }
  }
};

module.exports = logger;
