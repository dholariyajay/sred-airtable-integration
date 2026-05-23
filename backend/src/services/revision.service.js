const axios = require('axios');
const scraperService = require('./scraper.service');
const htmlParser = require('./html-parser.service');
const Page = require('../models/Page');
const RevisionHistory = require('../models/RevisionHistory');
const { delay } = require('../utils/pagination');
const logger = require('../utils/logger');

async function scrapeAllRevisionHistory(options = {}) {
  const { baseId, tableId } = options;

  const cookieCheck = await scraperService.validateCookies();
  if (!cookieCheck.valid) {
    throw new Error(`Cookies are invalid: ${cookieCheck.reason}. Please re-authenticate.`);
  }

  const filter = {};
  if (baseId) filter.baseId = baseId;
  if (tableId) filter.tableId = tableId;

  const pages = await Page.find(filter).lean();
  logger.info(`Starting revision history scrape for ${pages.length} pages`);

  const stats = { total: pages.length, processed: 0, changesFound: 0, errors: 0 };
  const cookieString = await scraperService.getCookieString();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    try {
      const html = await fetchRevisionHtml(cookieString, page.airtableRecordId, page.tableId);

      if (html) {
        const changes = htmlParser.parseRevisionHtml(html, page.airtableRecordId);

        for (const change of changes) {
          await RevisionHistory.findOneAndUpdate(
            { uuid: change.uuid },
            change,
            { upsert: true }
          );
          stats.changesFound++;
        }
      }

      stats.processed++;

      // Log progress every 10 records
      if ((i + 1) % 10 === 0 || i === pages.length - 1) {
        logger.info(`Progress: ${i + 1}/${pages.length} pages, ${stats.changesFound} changes found`);
      }

      await delay(300);

      // Re-validate cookies every 50 requests to catch expiry early
      if ((i + 1) % 50 === 0) {
        const recheck = await scraperService.validateCookies();
        if (!recheck.valid) {
          logger.error('Cookies expired mid-scrape — stopping gracefully');
          stats.errors++;
          return { ...stats, stoppedReason: 'cookies_expired' };
        }
      }

    } catch (err) {
      logger.error(`Error scraping page ${page.airtableRecordId}: ${err.message}`);
      stats.errors++;

      if (err.response && [401, 403].includes(err.response.status)) {
        logger.error('Auth failed during scrape — stopping');
        return { ...stats, stoppedReason: 'cookies_expired' };
      }
    }
  }

  logger.info('Revision scrape complete');
  return stats;
}

async function fetchRevisionHtml(cookieString, recordId, tableId) {
  try {
    const response = await axios.get(
      'https://airtable.com/v0.3/readRowActivitiesAndComments',
      {
        params: { rowId: recordId, tableId },
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'X-Requested-With': 'XMLHttpRequest'
        },
        timeout: 10000
      }
    );
    return response.data;
  } catch (err) {
    // 404 just means no history for this record
    if (err.response && err.response.status === 404) return null;
    throw err;
  }
}

module.exports = { scrapeAllRevisionHistory };
