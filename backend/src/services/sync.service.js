const oauthService = require('./oauth.service');
const airtableApi = require('./airtable-api.service');
const Base = require('../models/Base');
const AirtableTable = require('../models/AirtableTable');
const Page = require('../models/Page');
const AirtableUser = require('../models/AirtableUser');
const { delay } = require('../utils/pagination');
const logger = require('../utils/logger');

async function runFullSync() {
  const token = await oauthService.getValidToken();
  const stats = { bases: 0, tables: 0, pages: 0, users: 0, errors: [] };

  // --- Bases ---
  logger.info('=== SYNCING BASES ===');
  const bases = await airtableApi.fetchBases(token);

  for (const base of bases) {
    await Base.findOneAndUpdate(
      { airtableId: base.id },
      {
        airtableId: base.id,
        name: base.name,
        permissionLevel: base.permissionLevel,
        syncedAt: new Date()
      },
      { upsert: true }
    );
    stats.bases++;
  }
  logger.info(`Synced ${stats.bases} bases`);

  // --- Tables + Records ---
  logger.info('=== SYNCING TABLES ===');
  let allRecords = [];

  for (const base of bases) {
    try {
      const tables = await airtableApi.fetchTables(token, base.id);

      if (tables.length === 0) {
        logger.warn(`Base "${base.name}" has no tables`);
        continue;
      }

      for (const table of tables) {
        await AirtableTable.findOneAndUpdate(
          { baseId: base.id, airtableId: table.id },
          {
            airtableId: table.id,
            baseId: base.id,
            name: table.name,
            fields: (table.fields || []).map(f => ({
              id: f.id, name: f.name, type: f.type, description: f.description
            })),
            views: (table.views || []).map(v => ({
              id: v.id, name: v.name, type: v.type
            })),
            syncedAt: new Date()
          },
          { upsert: true }
        );
        stats.tables++;

        // Fetch all records with pagination
        console.log(`\n--- Fetching records for "${table.name}" ---`);
        try {
          const records = await airtableApi.fetchRecords(token, base.id, table.id);

          // TODO: consider adding bulk insert instead of one-by-one
          for (const record of records) {
            await Page.findOneAndUpdate(
              { baseId: base.id, tableId: table.id, airtableRecordId: record.id },
              {
                airtableRecordId: record.id,
                baseId: base.id,
                tableId: table.id,
                fields: record.fields,
                createdTime: record.createdTime ? new Date(record.createdTime) : null,
                syncedAt: new Date()
              },
              { upsert: true }
            );
            stats.pages++;
          }

          allRecords = allRecords.concat(records);
          logger.info(`Synced ${records.length} records from "${table.name}"`);
        } catch (err) {
          logger.error(`Error fetching records from "${table.name}":`, err.message);
          stats.errors.push({ table: table.name, error: err.message });
        }

        await delay(250);
      }
    } catch (err) {
      logger.error(`Error syncing base "${base.name}":`, err.message);
      stats.errors.push({ base: base.name, error: err.message });
    }
  }

  // --- Users ---
  logger.info('=== SYNCING USERS ===');
  const apiUsers = await airtableApi.fetchUsers(token);
  const recordUsers = airtableApi.extractUsersFromRecords(allRecords);

  // Merge — API users take priority over record-extracted ones
  const userMap = new Map();
  recordUsers.forEach(u => userMap.set(u.id, u));
  apiUsers.forEach(u => userMap.set(u.id, u));

  for (const user of userMap.values()) {
    await AirtableUser.findOneAndUpdate(
      { airtableUserId: user.id },
      {
        airtableUserId: user.id,
        email: user.email,
        name: user.name,
        syncedAt: new Date()
      },
      { upsert: true }
    );
    stats.users++;
  }
  logger.info(`Synced ${stats.users} users`);

  logger.info('=== SYNC COMPLETE ===');
  return stats;
}

module.exports = { runFullSync };
