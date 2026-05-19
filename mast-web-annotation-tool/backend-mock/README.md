# Backend Mock

Small mock API for the document annotation frontend. It serves the sample documents from `public/documents` and keeps regions in memory, so restarting the process resets the annotations.

## Run

```bash
npm start
```

By default the server listens on:

```text
http://localhost:3001
```

## Endpoints

```text
GET /health
GET /api/documents/doc1
PUT /api/documents/doc1/regions
GET /documents/doc1/pages/pg1.jpeg
```

Example body for saving regions:

```json
{
  "regions": []
}
```

## Environment

```text
PORT=3001
FRONTEND_ORIGIN=http://localhost:5173
```
