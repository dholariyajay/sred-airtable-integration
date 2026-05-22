# Airtable Integration — Full-Stack Assessment

## Overview

A full-stack integration with Airtable that covers three areas:

- **OAuth2 + PKCE authentication** — connects to Airtable's API, stores and auto-refreshes tokens
- **REST API data sync** — fetches bases, tables, records, and users with proper pagination handling
- **Custom scraper** — uses Puppeteer to authenticate into Airtable's web UI, extracts session cookies, and pulls revision history from their internal endpoint
- **Angular dashboard** — AG Grid + AG Charts powered data viewer with dynamic columns, search, filter, sort, and pagination

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

The backend will start on **http://localhost:3000**. You should see `Connected to MongoDB` and `Server running on http://localhost:3000` in the console.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

The frontend will start on **http://localhost:4200** and open automatically.

### 4. Verify

- Backend health check: open http://localhost:3000/api/health — should return `{"status":"ok"}`
- Frontend: open http://localhost:4200 — you should see the dashboard with a "Connect Airtable" button

## Usage

1. Click **Connect Airtable** — redirects to Airtable's OAuth consent screen, then back to the dashboard
2. Click **Sync Data** — fetches all bases, tables, records, and users from your Airtable account
3. Select a collection from the **Entity** dropdown — AG Grid populates with dynamic columns from that collection
4. Use **Search**, column **filters**, and **sorting** to explore the data
5. Click **Start Scraper** — prompts for Airtable login credentials (+ MFA if enabled), extracts session cookies, and fetches revision history for status/assignee changes

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/auth/connect` | Start OAuth flow |
| GET | `/api/auth/callback` | OAuth callback |
| GET | `/api/auth/status` | Check connection status |
| POST | `/api/sync` | Trigger full data sync |
| GET | `/api/sync/status` | Sync progress |
| GET | `/api/data/collections` | List MongoDB collections |
| GET | `/api/data/collections/:name` | Get collection data (flattened for AG Grid) |
| POST | `/api/scraper/login` | Start Puppeteer login |
| POST | `/api/scraper/mfa` | Submit MFA code |
| GET | `/api/scraper/cookies/status` | Check cookie validity |
| POST | `/api/scraper/scrape` | Start revision history scrape |
| GET | `/api/scraper/scrape/status` | Scrape progress |

## Architecture Decisions

I chose **OAuth2 + PKCE** because Airtable deprecated API keys in February 2024. PKCE prevents authorization code interception attacks, which matters even for local development since the callback goes through the browser.

The **Pages collection is separate** from the other models. The assessment explicitly required this, and it makes sense architecturally since records have dynamic fields that don't fit a fixed schema.

For **pagination**, Airtable returns a maximum of 100 records per request. I implemented an offset-based loop that follows the `offset` token until it's exhausted. There's a 250ms delay between requests to stay under the 5 req/sec rate limit.

I went with **Puppeteer for the scraper** because Airtable's revision history isn't exposed through their public API. The only way to get it is through their internal `/readRowActivitiesAndComments` endpoint, which requires browser session cookies. I considered using Playwright but went with Puppeteer since it has more established patterns for cookie extraction in Node.js environments.

For **user extraction**, I implemented a fallback approach. The SCIM endpoint requires a Business+ plan, so I first try SCIM, then fall back to extracting user info from `createdBy` and `lastModifiedBy` fields in the records I've already fetched. The `/meta/whoami` endpoint always works and gives us the authenticated user.

**Dynamic AG Grid columns** are generated at runtime from the actual data keys rather than being hardcoded. This handles the fact that different Airtable tables have completely different field schemas.

## Limitations

- The HTML parser selectors for revision history may need adjustment based on Airtable's current UI structure — their internal endpoints are undocumented and can change without notice
- The scraper stores cookies in MongoDB as a single session document. In a multi-user production setup, you'd want per-user cookie storage
- Rate limiting is handled with simple delays rather than a proper token bucket. Works fine for single-user assessment use
- The sync runs records one-by-one with `findOneAndUpdate`. For large datasets, bulk operations would be significantly faster
