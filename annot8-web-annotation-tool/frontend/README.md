# Annot8 Frontend

The Annot8 frontend is a Vue 3 and Vite application for visual document annotation. It provides the browser-based viewer used to inspect document pages and create, edit and persist structured annotation regions.

The frontend can run with the mock backend in `../backend-mock`, or in a static/test mode using the local fallback document model.

## Main Features

- Document page viewer with thumbnail navigation
- Zoom controls and document-coordinate mouse tracking
- Rectangle, polygon and polyline region creation
- Region selection, movement and deletion
- Rectangle resizing with visible minimum-size validation
- Polygon and polyline vertex editing
- Point insertion on selected polygon and polyline segments
- Endpoint extension for selected polylines
- Point deletion for selected polygon and polyline vertices
- Auto-scroll while drawing or editing near the visible viewer edges
- Save status feedback when regions are persisted through the API

## Technology Stack

- Vue 3
- Vite
- Konva for canvas rendering and interaction
- Bootstrap Vue Next and Bootstrap
- Vitest
- Vue Test Utils
- jsdom

## Project Structure

```text
frontend/
  src/
    components/viewer/   Viewer UI components and canvas helpers
    models/              Local fallback document model
    services/            Document API client
    utils/               Geometry, validation and viewer math helpers
    views/               Main viewer page
    App.vue              Application root
    main.js              Vue entry point
  tests/
    components/          Component tests
    unit/                Utility and helper tests
    views/               View-level tests
    setup.js             Konva and test setup
  package.json           Frontend scripts and dependencies
```

## Available Scripts

Install dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run tests in watch mode:

```bash
npm test
```

Run tests once with verbose output:

```bash
npm run test:verbose
```

Generate the HTML test report and open the Vitest UI:

```bash
npm run test:html:open
```

## Run Locally

From the frontend directory:

```bash
cd frontend
npm install
npm run dev
```

By default, local development uses the mock backend at:

```text
http://localhost:3001
```

To configure the API base URL explicitly, create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Expected value:

```text
VITE_API_BASE_URL=http://localhost:3001
```

Start the mock backend separately from `../backend-mock` when API-backed document loading and region persistence are needed.

## Run Tests

Run the frontend test suite:

```bash
npm test
```

Run a focused test file or pattern:

```bash
npm test -- AnnotationCanvas --run
```

The tests use mocked Konva objects for component interaction tests, so canvas behavior can be verified without a real browser canvas.

## Build

Create the production build:

```bash
npm run build
```

The output is written to:

```text
dist/
```

## Coordinate System

Annot8 separates stored region data from the visible canvas representation.

- Regions are stored in document coordinates, matching the original document image dimensions.
- Regions are rendered and interacted with in visible canvas coordinates.
- Zoom changes the visible canvas scale only.
- Zoom does not modify stored region coordinates.

This means that a region keeps the same document position and size regardless of the current zoom level.

## Region Types

Rectangle:

- Stored with `left`, `top`, `right` and `bottom` document coordinates.
- Created by dragging on the document.
- Can be moved and resized in select mode.

Polygon:

- Stored as an ordered list of document-coordinate points.
- Rendered as a closed point region.
- Supports vertex editing, point insertion and point deletion.

Polyline:

- Stored as an ordered list of document-coordinate points.
- Rendered as an open point region.
- Supports vertex editing, segment point insertion, endpoint extension and point deletion.

## Main Interaction Features

- Creation: rectangle drag creation, polygon point creation and polyline point creation.
- Selection: select mode allows existing regions to be selected for editing.
- Movement: selected rectangles, polygons and polylines can be moved within the visible document bounds.
- Rectangle resizing: selected rectangles use Konva Transformer anchors and visible minimum-size rules.
- Vertex editing: selected polygon and polyline vertices can be dragged.
- Point insertion: selected polygon and polyline segments support point insertion.
- Point deletion: selected polygon and polyline vertices can be removed, while preserving minimum valid point counts.
- Auto-scroll: the scrollable canvas wrapper moves when drawing or editing near visible edges.
- Minimum visible-size validation: interactive minimum sizes are measured in visible canvas coordinates.

## Current Scope

The frontend is designed for the current Annot8 annotation workflow and mock API integration. It does not include authentication, multi-user collaboration or production backend concerns.
