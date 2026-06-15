# Annot8

Annot8 is a web-based document annotation tool built for visual region annotation on document pages. The application lets users inspect page images and create structured regions such as rectangles, polygons and polylines.

This repository contains two main parts:

- a Vue frontend for the annotation viewer and editing workflow
- a Node.js mock backend used during development and demonstrations

The backend included here is intentionally a mock service. It provides document metadata, serves sample page images and stores regions in memory so the frontend can be exercised without a production backend.

## Public Demo

The application has been deployed for demonstration at:

```text
https://tfg-u4as.onrender.com/
```

## Project Scope

Annot8 currently focuses on the frontend annotation experience:

- loading a sample multi-page document
- navigating document pages
- zooming the viewer
- creating and editing visual annotation regions
- persisting the current region list through the mock backend

It is not presented as a production-ready annotation platform. Authentication, user management, durable database persistence and production API design are outside the current repository scope.

## Main Features

- Full-page document viewer with page navigation and thumbnails
- Zoom controls with document-coordinate preservation
- Rectangle, polygon and polyline region creation
- Region selection, movement and deletion
- Rectangle resizing with visible minimum-size validation
- Polygon and polyline vertex editing
- Point insertion on selected polygon and polyline segments
- Point deletion for selected polygon and polyline vertices
- Auto-scroll while drawing or editing near visible canvas edges
- Viewer status bar with page, zoom, tool, selection, region count, mouse and save status
- Mock persistence of regions through the development backend

## Repository Structure

```text
annot8-web-annotation-tool/
  backend-mock/      Mock HTTP backend and sample document assets
  frontend/          Vue 3 annotation frontend
  scripts/           Development helper scripts
  Dockerfile         Single-container demo build
  DOCKER.md          Docker usage notes
  package.json       Root scripts for running and testing the project
```

## Tech Stack

- Frontend: Vue 3, Vite, Konva, Bootstrap Vue Next
- Frontend tests: Vitest, Vue Test Utils, jsdom
- Backend mock: Node.js HTTP server
- Backend tests: Node.js test runner
- Demo packaging: Docker

## Run Locally

Install frontend dependencies once:

```bash
cd annot8-web-annotation-tool/frontend
npm install
```

Run the complete mock application from the project root:

```bash
cd annot8-web-annotation-tool
npm start
```

This starts:

```text
Frontend: http://localhost:5173
Backend mock: http://localhost:3001
```

The frontend calls the mock API at:

```text
http://localhost:3001/api/documents/doc1
```

## Run Services Separately

Frontend:

```bash
cd annot8-web-annotation-tool/frontend
npm install
npm run dev
```

Mock backend:

```bash
cd annot8-web-annotation-tool/backend-mock
npm install
npm start
```

The frontend can be configured with:

```text
VITE_API_BASE_URL=http://localhost:3001
```

## Build

Build the frontend from the project root:

```bash
npm run build
```

The production frontend output is generated in:

```text
frontend/dist
```

## Tests

Run the full repository test command:

```bash
npm test
```

This runs the frontend Vitest suite and the mock backend HTTP tests.

Useful frontend-only commands are documented in [frontend/README.md](./frontend/README.md). Mock backend commands are documented in [backend-mock/README.md](./backend-mock/README.md).

## Current Status

Annot8 is an active university final degree project implementation. The current codebase demonstrates the document viewer, visual annotation workflow and mock persistence layer. The included backend is a development and demo support component with in-memory storage, not a production service.

## Docker Demo

The project can also run as a single Docker container:

```bash
docker build -t annot8-web-annotation-tool .
docker run --rm -p 3001:3001 annot8-web-annotation-tool
```

Full Docker instructions are available in [DOCKER.md](./DOCKER.md).
