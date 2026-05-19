# Frontend

This frontend is a Vue 3 and Vite application for visual document annotation. It can run as a static frontend only, or connect to the mock backend in `../backend-mock` to load document metadata and persist regions during the current backend process.

## Requirements

To run the frontend only, you need:

- Node.js
- npm

To run it with the mock backend, start `../backend-mock` and set `VITE_API_BASE_URL`.

## Installation

Install the dependencies from the frontend directory:

```bash
npm install
```

## Run the Application

Start the development server:

```bash
npm run dev
```

Run the frontend against the mock backend:

```bash
cp .env.example .env
npm run dev
```

Build the application for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Run the Tests

Run the default test suite:

```bash
npm test
```

Run the tests with verbose output:

```bash
npm run test:verbose
```

Generate the HTML test report and launch the Vitest UI:

```bash
npm run test:html:open
```

## Current Scope

The application currently includes:

- page rendering from static document images
- page navigation through buttons and thumbnails
- zoom controls with bounded zoom levels
- document-space mouse coordinate display
- rectangle region creation, editing, deletion, and mock persistence
- unit tests for viewer math utilities
- component tests for the main viewer behavior
