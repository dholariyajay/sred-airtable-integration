const express = require('express');
const mongoose = require('mongoose');

jest.mock('mongoose', () => {
  const mockDb = {
    listCollections: jest.fn(),
    collection: jest.fn()
  };
  return {
    connection: { db: mockDb },
    Schema: jest.fn(),
    model: jest.fn()
  };
});

const dataRoutes = require('../routes/data.routes');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/data', dataRoutes);
  return app;
}

const request = (app, method, url) => {
  return new Promise((resolve) => {
    const req = require('http').request(
      { method, hostname: 'localhost', path: url },
      (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }
    );
    req.end();
  });
};

describe('data routes', () => {
  const db = mongoose.connection.db;

  describe('GET /api/data/collections', () => {
    it('returns filtered collection names', async () => {
      db.listCollections.mockReturnValue({
        toArray: () => Promise.resolve([
          { name: 'bases' },
          { name: 'pages' },
          { name: 'oauthtokens' },
          { name: 'scrapersessions' },
          { name: 'system.indexes' },
          { name: 'airtabletables' }
        ])
      });

      const app = buildApp();
      const server = app.listen(0);
      const port = server.address().port;

      const res = await fetch(`http://localhost:${port}/api/data/collections`);
      const data = await res.json();

      expect(data).toEqual(['bases', 'pages', 'airtabletables']);
      expect(data).not.toContain('oauthtokens');
      expect(data).not.toContain('scrapersessions');
      expect(data).not.toContain('system.indexes');

      server.close();
    });
  });

  describe('GET /api/data/collections/:name', () => {
    it('returns 404 for non-existent collection', async () => {
      db.listCollections.mockReturnValue({
        toArray: () => Promise.resolve([])
      });

      const app = buildApp();
      const server = app.listen(0);
      const port = server.address().port;

      const res = await fetch(`http://localhost:${port}/api/data/collections/nonexistent`);
      expect(res.status).toBe(404);

      server.close();
    });

    it('flattens nested fields object for AG Grid consumption', async () => {
      db.listCollections.mockImplementation(({ name }) => ({
        toArray: () => Promise.resolve(name === 'pages' ? [{ name: 'pages' }] : [])
      }));

      const mockFind = jest.fn().mockReturnValue({
        limit: () => ({
          toArray: () => Promise.resolve([
            {
              _id: { toString: () => '507f1f77bcf86cd799439011' },
              baseId: 'appXYZ',
              tableId: 'tblABC',
              fields: {
                'Title': 'Bug fix',
                'Status': 'Open',
                'Tags': ['urgent', 'frontend'],
                'Assignee': { name: 'Alice', email: 'alice@test.com' }
              }
            }
          ])
        })
      });

      db.collection.mockReturnValue({ find: mockFind });

      const app = buildApp();
      const server = app.listen(0);
      const port = server.address().port;

      const res = await fetch(`http://localhost:${port}/api/data/collections/pages`);
      const data = await res.json();

      expect(data).toHaveLength(1);
      expect(data[0]._id).toBe('507f1f77bcf86cd799439011');
      expect(data[0].Title).toBe('Bug fix');
      expect(data[0].Status).toBe('Open');
      expect(data[0].Tags).toBe('urgent, frontend');
      expect(data[0].Assignee).toBe('Alice');
      expect(data[0].fields).toBeUndefined();

      server.close();
    });
  });
});
