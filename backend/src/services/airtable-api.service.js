const axios = require('axios');
const { fetchAllPaginated } = require('../utils/pagination');
const { AIRTABLE_API_BASE } = require('../config/constants');
const logger = require('../utils/logger');

async function fetchBases(token) {
  logger.info('Fetching bases...');
  return await fetchAllPaginated(
    `${AIRTABLE_API_BASE}/meta/bases`, token, 'bases'
  );
}

// tables endpoint returns all at once, but reusing paginated fetch is simpler
async function fetchTables(token, baseId) {
  logger.info(`Fetching tables for base ${baseId}`);
  return await fetchAllPaginated(
    `${AIRTABLE_API_BASE}/meta/bases/${baseId}/tables`, token, 'tables'
  );
}

async function fetchRecords(token, baseId, tableId) {
  logger.info(`Fetching records for table ${tableId} in base ${baseId}`);
  return await fetchAllPaginated(
    `${AIRTABLE_API_BASE}/${baseId}/${tableId}`, token, 'records'
  );
}

// Airtable has no single user-list endpoint that works on all plans.
// SCIM needs Business+, so try that but fall back to whoami + record metadata.
async function fetchUsers(token) {
  logger.info('Fetching users...');
  const users = [];

  // whoami always works regardless of plan
  try {
    const whoami = await axios.get(`${AIRTABLE_API_BASE}/meta/whoami`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    users.push({
      id: whoami.data.id,
      email: whoami.data.email || null,
      name: whoami.data.email || 'Authenticated User',
      source: 'whoami'
    });
  } catch (err) {
    logger.warn('whoami failed:', err.message);
  }

  // SCIM needs Business+, will 403 on free/pro
  try {
    const scimResponse = await axios.get('https://airtable.com/scim/v2/Users', {
      headers: { Authorization: `Bearer ${token}` },
      params: { startIndex: 1, count: 100 }
    });
    if (scimResponse.data.Resources) {
      for (const user of scimResponse.data.Resources) {
        users.push({
          id: user.id,
          email: user.userName,
          name: user.displayName || user.userName,
          source: 'scim'
        });
      }
    }
  } catch {
    logger.info('SCIM not available (probably free/pro plan), using record metadata instead');
  }

  return users;
}

function extractUsersFromRecords(records) {
  const userMap = new Map();

  records.forEach(record => {
    if (record.createdBy) {
      userMap.set(record.createdBy.id, {
        id: record.createdBy.id,
        email: record.createdBy.email || null,
        name: record.createdBy.name || record.createdBy.id,
        source: 'record_metadata'
      });
    }
    if (record.lastModifiedBy) {
      userMap.set(record.lastModifiedBy.id, {
        id: record.lastModifiedBy.id,
        email: record.lastModifiedBy.email || null,
        name: record.lastModifiedBy.name || record.lastModifiedBy.id,
        source: 'record_metadata'
      });
    }

    // Check collaborator-type field values
    if (record.fields) {
      Object.values(record.fields).forEach(val => {
        if (val && typeof val === 'object' && val.id && val.email) {
          userMap.set(val.id, {
            id: val.id,
            email: val.email,
            name: val.name || val.email,
            source: 'field_value'
          });
        }
      });
    }
  });

  return Array.from(userMap.values());
}

module.exports = { fetchBases, fetchTables, fetchRecords, fetchUsers, extractUsersFromRecords };
