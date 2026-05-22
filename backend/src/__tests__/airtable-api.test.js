const axios = require('axios');
const { extractUsersFromRecords } = require('../services/airtable-api.service');

jest.mock('axios');

describe('airtable-api.service', () => {
  describe('extractUsersFromRecords', () => {
    it('extracts users from createdBy field', () => {
      const records = [{
        id: 'rec1',
        createdBy: { id: 'usr_1', email: 'alice@test.com', name: 'Alice' },
        fields: {}
      }];

      const users = extractUsersFromRecords(records);

      expect(users).toHaveLength(1);
      expect(users[0]).toMatchObject({
        id: 'usr_1',
        email: 'alice@test.com',
        name: 'Alice',
        source: 'record_metadata'
      });
    });

    it('extracts users from lastModifiedBy field', () => {
      const records = [{
        id: 'rec1',
        lastModifiedBy: { id: 'usr_2', email: 'bob@test.com', name: 'Bob' },
        fields: {}
      }];

      const users = extractUsersFromRecords(records);
      expect(users).toHaveLength(1);
      expect(users[0].id).toBe('usr_2');
    });

    it('extracts users from collaborator-type field values', () => {
      const records = [{
        id: 'rec1',
        fields: {
          'Assignee': { id: 'usr_3', email: 'carol@test.com', name: 'Carol' },
          'Title': 'Some task'
        }
      }];

      const users = extractUsersFromRecords(records);
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('carol@test.com');
    });

    it('deduplicates users across multiple records', () => {
      const records = [
        {
          id: 'rec1',
          createdBy: { id: 'usr_1', email: 'alice@test.com', name: 'Alice' },
          lastModifiedBy: { id: 'usr_1', email: 'alice@test.com', name: 'Alice' },
          fields: {}
        },
        {
          id: 'rec2',
          createdBy: { id: 'usr_1', email: 'alice@test.com', name: 'Alice' },
          fields: {}
        }
      ];

      const users = extractUsersFromRecords(records);
      expect(users).toHaveLength(1);
    });

    it('merges users from multiple sources', () => {
      const records = [
        {
          id: 'rec1',
          createdBy: { id: 'usr_1', email: 'a@t.com', name: 'A' },
          lastModifiedBy: { id: 'usr_2', email: 'b@t.com', name: 'B' },
          fields: {
            'Reviewer': { id: 'usr_3', email: 'c@t.com', name: 'C' }
          }
        }
      ];

      const users = extractUsersFromRecords(records);
      expect(users).toHaveLength(3);
      expect(users.map(u => u.id).sort()).toEqual(['usr_1', 'usr_2', 'usr_3']);
    });

    it('handles records with no user info gracefully', () => {
      const records = [
        { id: 'rec1', fields: { 'Title': 'Test' } },
        { id: 'rec2', fields: {} }
      ];

      const users = extractUsersFromRecords(records);
      expect(users).toHaveLength(0);
    });

    it('handles empty records array', () => {
      expect(extractUsersFromRecords([])).toEqual([]);
    });

    it('uses id as name fallback when name is missing', () => {
      const records = [{
        id: 'rec1',
        createdBy: { id: 'usr_noname' },
        fields: {}
      }];

      const users = extractUsersFromRecords(records);
      expect(users[0].name).toBe('usr_noname');
    });
  });
});
