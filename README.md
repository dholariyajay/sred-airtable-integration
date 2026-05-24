# Airtable Integration

## Overview

Full-stack integration with Airtable for a technical assessment. Three main parts:

- **OAuth2 + PKCE auth** - connects to Airtable's API, auto-refreshes tokens
- **Data sync** - pulls bases, tables, records, and users with pagination
- **Puppeteer scraper** - logs into Airtable's web UI, grabs session cookies, fetches revision history from their internal endpoint
- **Angular dashboard** - AG Grid + AG Charts for viewing synced data

## Tech Stack

- **Frontend:** Angular 19, AG Grid 33.0, AG Charts, Angular Material
- **Backend:** Node.js 22, Express, Mongoose
- **Database:** MongoDB

## Prerequisites

- Node.js 22+
- MongoDB 7+ running locally on default port (27017)
- An Airtable account with at least one base
- An Airtable OAuth integration (see setup below)

## Setup

### 1. Airtable OAuth Registration

1. Go to https://airtable.com/create/oauth
2. Register a new OAuth integration
3. Set redirect URL to `http://localhost:3000/api/auth/callback`
4. Required scopes: `data.records:read`, `schema.bases:read`, `user.email:read`
5. Copy the Client ID and generate a Client Secret

### 2. Backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in your Airtable credentials:

```bash
# macOS/Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Then start the server:

```bash
npm run dev
```

Backend starts on **http://localhost:3000**.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

Opens on **http://localhost:4200**.

### 4. Verify

- http://localhost:3000/api/health should return `{"status":"ok"}`
- http://localhost:4200 should show the dashboard

## Usage

1. Click **Connect Airtable** to go through OAuth
2. Click **Sync Data** to pull bases, tables, records, users
3. Pick a collection from the **Entity** dropdown to load data into the grid
4. Use search, column filters, sorting to explore
5. **Start Scraper** prompts for Airtable credentials, handles MFA, then scrapes revision history

## API Endpoints

| Method | Endpoint | What it does |
|--------|----------|-------------|
| GET | `/api/health` | health check |
| GET | `/api/auth/connect` | kicks off OAuth flow |
| GET | `/api/auth/callback` | OAuth redirect handler |
| GET | `/api/auth/status` | is Airtable connected? |
| POST | `/api/sync` | trigger full data sync |
| GET | `/api/sync/status` | sync progress |
| GET | `/api/data/collections` | list available collections |
| GET | `/api/data/collections/:name` | collection data (flattened for grid) |
| POST | `/api/scraper/login` | start Puppeteer login |
| POST | `/api/scraper/mfa` | submit MFA code |
| GET | `/api/scraper/cookies/status` | are cookies still valid? |
| POST | `/api/scraper/scrape` | start revision scrape |
| GET | `/api/scraper/scrape/status` | scrape progress |

## Architecture Notes

Airtable deprecated API keys in February 2024, so OAuth2 + PKCE is the only real option. I went with PKCE over the basic flow since the callback goes through the browser anyway.

Records live in a separate `pages` collection because Airtable records have dynamic fields that don't map to a fixed schema. I store the raw `fields` object and flatten it on the way out to AG Grid.

Pagination follows Airtable's offset token pattern (max 100 per request). 250ms delay between pages to stay under 5 req/sec.

The scraper uses Puppeteer because revision history isn't in the public API - you have to hit their internal `/readRowActivitiesAndComments` endpoint with browser cookies. Playwright would've worked too but Puppeteer has better docs for cookie extraction.

User extraction is a bit hacky: SCIM needs Business+ plan (which I don't have), so I try that first, then fall back to pulling user info out of `createdBy`/`lastModifiedBy` fields from the records I already fetched. `/meta/whoami` always works for the current user.

AG Grid columns are built dynamically from whatever keys the data has, since every Airtable table has different fields.

## Known Limitations

- HTML parser selectors for revision history may break if Airtable changes their markup (their internal endpoints are undocumented)
- Single scraper session stored in MongoDB - would need per-user sessions for multi-user
- Rate limiting is just `setTimeout` delays, not a proper token bucket
- Records sync one-by-one with `findOneAndUpdate` - should be bulk ops for large datasets
