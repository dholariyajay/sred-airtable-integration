const cheerio = require('cheerio');

/*
 * Parses Airtable revision history into structured documents.
 * The internal endpoint can return JSON or HTML depending on the version,
 * so we handle both. Only status and assignee changes are kept.
 */
function parseRevisionHtml(htmlOrJson, ticketId) {
  if (htmlOrJson && typeof htmlOrJson === 'object') {
    return parseJsonResponse(htmlOrJson, ticketId);
  }

  if (typeof htmlOrJson === 'string') {
    try {
      const data = JSON.parse(htmlOrJson);
      return parseJsonResponse(data, ticketId);
    } catch {
      return parseHtmlResponse(htmlOrJson, ticketId);
    }
  }

  return [];
}

function parseJsonResponse(data, ticketId) {
  const changes = [];
  const activities = data.activities || data.rowActivities || [];

  activities.forEach(activity => {
    if (activity.type !== 'fieldChanged' && activity.action !== 'update') return;

    const fieldChanges = activity.fieldChanges || activity.changes || [];
    fieldChanges.forEach(fc => {
      const columnType = normalizeColumnType(fc.fieldName || fc.columnName || '');

      if (columnType === 'status' || columnType === 'assignee') {
        const actId = activity.id || activity.activityId || generateId();
        changes.push({
          uuid: actId,
          issueId: ticketId,
          columnType,
          oldValue: stringifyValue(fc.oldValue || fc.previousValue),
          newValue: stringifyValue(fc.newValue || fc.currentValue),
          createdDate: new Date(activity.createdTime || activity.timestamp),
          authoredBy: activity.originatingUserId || activity.userId || activity.actorId
        });
      }
    });
  });

  return changes;
}

function parseHtmlResponse(html, ticketId) {
  const $ = cheerio.load(html);
  const changes = [];

  // TODO: selectors may need updating if Airtable changes their markup
  $('[data-activity-id], .activity-item, .revision-item').each((i, el) => {
    const $el = $(el);
    const activityId = $el.attr('data-activity-id') || `activity-${i}`;
    const userId = $el.attr('data-user-id') || $el.find('[data-user-id]').attr('data-user-id') || '';
    const timestamp = $el.attr('data-timestamp') || $el.find('time').attr('datetime') || '';

    $el.find('.field-change, .change-item').each((j, changeEl) => {
      const $change = $(changeEl);
      const fieldName = $change.find('.field-name, .column-name').text().trim();
      const columnType = normalizeColumnType(fieldName);

      if (columnType !== 'status' && columnType !== 'assignee') return;

      changes.push({
        uuid: activityId,
        issueId: ticketId,
        columnType,
        oldValue: $change.find('.old-value, .previous-value').text().trim(),
        newValue: $change.find('.new-value, .current-value').text().trim(),
        createdDate: new Date(timestamp),
        authoredBy: userId
      });
    });
  });

  return changes;
}

function normalizeColumnType(fieldName) {
  const lower = fieldName.toLowerCase().trim();
  if (lower === 'status' || lower.includes('status')) return 'status';
  if (lower === 'assignee' || lower.includes('assign') || lower === 'owner' || lower.includes('responsible')) return 'assignee';
  return lower;
}

function stringifyValue(val) {
  if (val == null) return '';
  if (typeof val === 'object') return val.name || val.email || JSON.stringify(val);
  return String(val);
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

module.exports = { parseRevisionHtml };
