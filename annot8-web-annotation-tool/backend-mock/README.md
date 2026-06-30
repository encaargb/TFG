# Annot8 Mock Backend

This directory contains the read-only Node.js mock backend used by Annot8.

For installation, execution and testing instructions, see the [main repository README](../../README.md).

## Purpose

The mock backend provides the resources required by the frontend without requiring a production backend or database.

It is responsible for:

* returning sample document metadata
* returning predefined annotation schemas
* serving document page images
* exposing a health endpoint
* serving the compiled frontend when available

It does not receive or store region changes.

## Available Endpoints

| Method | Route                                 | Purpose                             |
| ------ | ------------------------------------- | ----------------------------------- |
| `GET`  | `/health`                             | Return the server status            |
| `GET`  | `/api/documents/doc1`                 | Return the sample document metadata |
| `GET`  | `/api/project-documents/doc1/schemas` | Return the annotation schemas       |
| `GET`  | `/documents/doc1/pages/pg1.jpeg`      | Return a sample document page       |

Unknown document identifiers return `404`.

Unsupported methods return `405`.

## Sample Document

The mock backend exposes one sample document:

```text
doc1
```

Its page images are stored in:

```text
backend-mock/public/documents/doc1/pages
```

## Region Storage

The mock backend does not store regions.

Regions and assigned annotations are managed by the frontend and stored in the browser using `localStorage`.

The current mock API does not provide region creation, update or deletion endpoints.

## Production Frontend

When `frontend/dist` is available, the backend also serves the compiled Vue application.

This allows the frontend, mock API and sample assets to be served from the same address in Docker and the deployed demo.

## Technology

The backend uses built-in Node.js functionality:

* Node.js HTTP server
* Node.js filesystem APIs
* Node.js test runner

It has no external runtime dependencies.

## Limitations

* one sample document
* read-only API
* no authentication
* no database
* no server-side region persistence
* no multi-user synchronisation
