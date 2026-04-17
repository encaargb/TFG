# Frontend

This frontend is a Vue 3 and Vite application for visual document viewing. At its current stage, the project is a frontend-only viewer that renders document pages, allows page navigation, supports zooming, and displays mouse coordinates over the document.

## Requirements

To run this project, you only need:

- Node.js
- npm

No backend service, database, or additional runtime is required.

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
- unit tests for viewer math utilities
- component tests for the main viewer behavior
