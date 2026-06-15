# Annot8 Mock Backend

This directory contains the mock HTTP backend used by the Annot8 frontend during development and demonstrations. It serves sample document metadata, static page images and an in-memory region list.

The mock backend is intentionally small. It is not a production API and does not provide authentication, user management or durable database storage.

## Purpose

The mock backend supports frontend development by providing:

- a document metadata endpoint
- static document page assets
- region persistence for the current server process
- a simple API shape for loading and saving annotations
- a production-build fallback that can serve `frontend/dist` in the Docker demo

## Technology Stack

- Node.js
- Built-in `node:http` server
- Built-in filesystem APIs for static assets
- Node.js test runner for backend tests

## Run Locally

Install dependencies:

```bash
npm install
```

Start the server:

```bash
npm start
```

The default local URL is:

```text
http://localhost:3001
```

## Available Scripts

Start the mock backend:

```bash
npm start
```

Start the mock backend with the development alias:

```bash
npm run dev
```

Run backend tests:

```bash
npm test
```

## Environment

```text
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```

If `FRONTEND_ORIGIN` is not set, the server allows all origins for the development/demo workflow.

## Main API Endpoints

```text
GET /health
GET /api/documents/doc1
PUT /api/documents/doc1/regions
GET /documents/doc1/pages/pg1.jpeg
```

Unsupported document ids return `404`.

## Data Provided

The mock backend currently exposes one API document:

```text
doc1
```

The document response includes:

- document id
- document title
- page image URLs
- current regions array

Sample document files are served from:

```text
backend-mock/public/documents
```

The repository may contain additional sample assets under `public/documents`, but the current API store exposes `doc1`.

## Region Persistence

Regions are stored in memory inside the Node.js process.

Saving regions uses:

```text
PUT /api/documents/doc1/regions
```

Expected request body:

```json
{
  "regions": []
}
```

The mock backend replaces the full regions array with the submitted array. It does not apply partial updates, patches or conflict resolution.

Restarting the backend resets the regions to the initial in-memory state.

## Limitations

- In-memory storage only
- No authentication or authorization
- No production database
- No multi-user synchronization
- No partial region update endpoint
- Saving regions replaces the full regions array
- Intended for frontend development and demonstrations only

## Static Frontend Fallback

When a production frontend build exists in `../frontend/dist`, the mock backend can serve it for the single-container demo. API routes and document asset routes are handled first; other GET requests fall back to the frontend build.
