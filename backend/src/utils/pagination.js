const axios = require('axios');
const { AIRTABLE_API_BASE, RATE_LIMIT_DELAY_MS } = require('../config/constants');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Airtable caps responses at 100 records, so loop with offset token.
// 250ms delay to stay under 5 req/sec.
async function fetchAllPaginated(endpoint, token, dataKey, extraParams = {}) {
  let allResults = [];
  let offset = null;
  let pageCount = 0;

  do {
    const params = { ...extraParams };
    if (offset) params.offset = offset;

    const url = endpoint.startsWith('http') ? endpoint : `${AIRTABLE_API_BASE}/${endpoint}`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}` },
      params
    });

    const pageData = response.data[dataKey] || [];
    allResults = allResults.concat(pageData);
    offset = response.data.offset || null;
    pageCount++;

    console.log(`  [pagination] Page ${pageCount}: got ${pageData.length} ${dataKey} (total: ${allResults.length})`);

    if (offset) {
      await delay(RATE_LIMIT_DELAY_MS);
    }
  } while (offset);

  return allResults;
}

module.exports = { fetchAllPaginated, delay };
