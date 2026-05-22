const { parseRevisionHtml } = require('../services/html-parser.service');

describe('html-parser.service', () => {
  const TICKET_ID = 'rec_ABC123';

  describe('parseRevisionHtml — JSON input', () => {
    it('parses status changes from JSON object', () => {
      const input = {
        activities: [{
          id: 'act_001',
          type: 'fieldChanged',
          createdTime: '2024-06-15T10:30:00.000Z',
          originatingUserId: 'usr_x1',
          fieldChanges: [{
            fieldName: 'Status',
            oldValue: 'Open',
            newValue: 'In Progress'
          }]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uuid: 'act_001',
        issueId: TICKET_ID,
        columnType: 'status',
        oldValue: 'Open',
        newValue: 'In Progress',
        authoredBy: 'usr_x1'
      });
      expect(result[0].createdDate).toBeInstanceOf(Date);
    });

    it('parses assignee changes from JSON object', () => {
      const input = {
        activities: [{
          id: 'act_002',
          type: 'fieldChanged',
          createdTime: '2024-07-01T14:00:00.000Z',
          originatingUserId: 'usr_y2',
          fieldChanges: [{
            fieldName: 'Assigned To',
            oldValue: { name: 'Alice' },
            newValue: { name: 'Bob' }
          }]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0].columnType).toBe('assignee');
      expect(result[0].oldValue).toBe('Alice');
      expect(result[0].newValue).toBe('Bob');
    });

    it('parses JSON string input the same as object', () => {
      const input = JSON.stringify({
        activities: [{
          id: 'act_003',
          type: 'fieldChanged',
          createdTime: '2024-08-10T09:00:00.000Z',
          userId: 'usr_z3',
          fieldChanges: [{
            fieldName: 'Status',
            oldValue: 'In Progress',
            newValue: 'Closed'
          }]
        }]
      });

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('act_003');
      expect(result[0].authoredBy).toBe('usr_z3');
    });

    it('filters out non-status/non-assignee field changes', () => {
      const input = {
        activities: [{
          id: 'act_004',
          type: 'fieldChanged',
          createdTime: '2024-09-01T12:00:00.000Z',
          originatingUserId: 'usr_a1',
          fieldChanges: [
            { fieldName: 'Title', oldValue: 'Old title', newValue: 'New title' },
            { fieldName: 'Status', oldValue: 'Open', newValue: 'Closed' },
            { fieldName: 'Description', oldValue: '', newValue: 'Some text' },
            { fieldName: 'Responsible Person', oldValue: 'Alice', newValue: 'Bob' }
          ]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(2);
      expect(result.map(r => r.columnType)).toEqual(['status', 'assignee']);
    });

    it('handles alternative JSON structure (rowActivities + action)', () => {
      const input = {
        rowActivities: [{
          activityId: 'act_005',
          action: 'update',
          timestamp: '2024-10-15T16:30:00.000Z',
          actorId: 'usr_alt',
          changes: [{
            columnName: 'Status',
            previousValue: 'Draft',
            currentValue: 'Review'
          }]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uuid: 'act_005',
        issueId: TICKET_ID,
        columnType: 'status',
        oldValue: 'Draft',
        newValue: 'Review',
        authoredBy: 'usr_alt'
      });
    });

    it('handles multiple activities with multiple changes', () => {
      const input = {
        activities: [
          {
            id: 'act_m1',
            type: 'fieldChanged',
            createdTime: '2024-11-01T08:00:00.000Z',
            originatingUserId: 'usr_1',
            fieldChanges: [
              { fieldName: 'Status', oldValue: 'Open', newValue: 'In Progress' },
              { fieldName: 'Assignee', oldValue: '', newValue: 'Carol' }
            ]
          },
          {
            id: 'act_m2',
            type: 'fieldChanged',
            createdTime: '2024-11-02T10:00:00.000Z',
            originatingUserId: 'usr_2',
            fieldChanges: [
              { fieldName: 'Status', oldValue: 'In Progress', newValue: 'Closed' }
            ]
          }
        ]
      };

      const result = parseRevisionHtml(input, TICKET_ID);

      expect(result).toHaveLength(3);
      expect(result[0].uuid).toBe('act_m1');
      expect(result[1].uuid).toBe('act_m1');
      expect(result[2].uuid).toBe('act_m2');
    });

    it('skips non-fieldChanged activity types', () => {
      const input = {
        activities: [
          { id: 'act_skip', type: 'comment', fieldChanges: [] },
          { id: 'act_keep', type: 'fieldChanged', createdTime: '2024-12-01T00:00:00.000Z', originatingUserId: 'u1',
            fieldChanges: [{ fieldName: 'Status', oldValue: 'A', newValue: 'B' }] }
        ]
      };

      const result = parseRevisionHtml(input, TICKET_ID);
      expect(result).toHaveLength(1);
      expect(result[0].uuid).toBe('act_keep');
    });

    it('stringifies object values (name, email, JSON fallback)', () => {
      const input = {
        activities: [{
          id: 'act_obj',
          type: 'fieldChanged',
          createdTime: '2024-12-15T00:00:00.000Z',
          originatingUserId: 'u1',
          fieldChanges: [{
            fieldName: 'Owner',
            oldValue: { email: 'old@test.com' },
            newValue: { id: 'usr_new', role: 'admin' }
          }]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);
      expect(result[0].oldValue).toBe('old@test.com');
      expect(result[0].newValue).toContain('usr_new');
    });
  });

  describe('parseRevisionHtml — HTML input', () => {
    it('parses status changes from HTML with data attributes', () => {
      const html = `
        <div data-activity-id="act_html_1" data-user-id="usr_h1" data-timestamp="2024-06-20T12:00:00Z">
          <div class="field-change">
            <span class="field-name">Status</span>
            <span class="old-value">Open</span>
            <span class="new-value">In Progress</span>
          </div>
        </div>
      `;

      const result = parseRevisionHtml(html, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        uuid: 'act_html_1',
        issueId: TICKET_ID,
        columnType: 'status',
        oldValue: 'Open',
        newValue: 'In Progress',
        authoredBy: 'usr_h1'
      });
    });

    it('parses assignee changes from HTML', () => {
      const html = `
        <div class="activity-item" data-activity-id="act_html_2" data-user-id="usr_h2" data-timestamp="2024-07-10T08:00:00Z">
          <div class="change-item">
            <span class="column-name">Assignee</span>
            <span class="previous-value">Alice</span>
            <span class="current-value">Bob</span>
          </div>
        </div>
      `;

      const result = parseRevisionHtml(html, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0].columnType).toBe('assignee');
      expect(result[0].oldValue).toBe('Alice');
      expect(result[0].newValue).toBe('Bob');
    });

    it('filters non-relevant fields in HTML', () => {
      const html = `
        <div data-activity-id="act_html_3" data-user-id="usr_h3" data-timestamp="2024-08-01T00:00:00Z">
          <div class="field-change">
            <span class="field-name">Title</span>
            <span class="old-value">Old</span>
            <span class="new-value">New</span>
          </div>
          <div class="field-change">
            <span class="field-name">Status</span>
            <span class="old-value">Draft</span>
            <span class="new-value">Published</span>
          </div>
        </div>
      `;

      const result = parseRevisionHtml(html, TICKET_ID);

      expect(result).toHaveLength(1);
      expect(result[0].columnType).toBe('status');
    });
  });

  describe('parseRevisionHtml — edge cases', () => {
    it('returns empty array for null input', () => {
      expect(parseRevisionHtml(null, TICKET_ID)).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      expect(parseRevisionHtml(undefined, TICKET_ID)).toEqual([]);
    });

    it('returns empty array for empty object', () => {
      expect(parseRevisionHtml({}, TICKET_ID)).toEqual([]);
    });

    it('returns empty array for empty activities', () => {
      expect(parseRevisionHtml({ activities: [] }, TICKET_ID)).toEqual([]);
    });

    it('returns empty array for HTML with no matching selectors', () => {
      const html = '<div><p>No revision data here</p></div>';
      expect(parseRevisionHtml(html, TICKET_ID)).toEqual([]);
    });

    it('handles null oldValue/newValue gracefully', () => {
      const input = {
        activities: [{
          id: 'act_null',
          type: 'fieldChanged',
          createdTime: '2024-12-01T00:00:00.000Z',
          originatingUserId: 'u1',
          fieldChanges: [{
            fieldName: 'Status',
            oldValue: null,
            newValue: 'Active'
          }]
        }]
      };

      const result = parseRevisionHtml(input, TICKET_ID);
      expect(result[0].oldValue).toBe('');
      expect(result[0].newValue).toBe('Active');
    });
  });

  describe('column type normalization', () => {
    const makeInput = (fieldName) => ({
      activities: [{
        id: 'act_norm',
        type: 'fieldChanged',
        createdTime: '2024-01-01T00:00:00.000Z',
        originatingUserId: 'u1',
        fieldChanges: [{ fieldName, oldValue: 'A', newValue: 'B' }]
      }]
    });

    it.each([
      ['Status', 'status'],
      ['status', 'status'],
      ['Task Status', 'status'],
      ['Assignee', 'assignee'],
      ['Assigned To', 'assignee'],
      ['Owner', 'assignee'],
      ['Responsible', 'assignee'],
    ])('normalizes "%s" → "%s"', (input, expected) => {
      const result = parseRevisionHtml(makeInput(input), TICKET_ID);
      expect(result).toHaveLength(1);
      expect(result[0].columnType).toBe(expected);
    });

    it.each([
      'Title', 'Description', 'Priority', 'Created', 'Notes'
    ])('filters out "%s" as non-relevant', (fieldName) => {
      const result = parseRevisionHtml(makeInput(fieldName), TICKET_ID);
      expect(result).toHaveLength(0);
    });
  });
});
