# Annot8 Web Annotation Tool

This directory contains the complete Annot8 application.

For installation, execution and testing instructions, see the [main repository README](../README.md).

## Project Structure

Annot8 is divided into two main components:

* **Frontend:** Vue 3 application responsible for document visualisation, canvas interaction, region editing, annotation assignment and browser persistence.
* **Mock backend:** read-only Node.js server that provides the sample document, page images and annotation schemas.

## Data Flow

1. The frontend requests the sample document metadata and annotation schemas.
2. Document page images are loaded from the mock backend.
3. The user creates and edits regions in the browser.
4. Regions and assigned annotations are stored in `localStorage`.

The mock backend does not store region changes.

## Directory Structure

```text
annot8-web-annotation-tool/
├── frontend/          Vue 3 annotation application
├── backend-mock/      Read-only mock server and sample assets
├── scripts/           Development helper scripts
├── Dockerfile         Docker image definition
├── DOCKER.md          Docker architecture notes
├── package.json       Root project scripts
└── README.md          Technical project overview
```

## Root Scripts

The root `package.json` provides the following commands:

| Script                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `npm run setup`        | Install frontend dependencies                |
| `npm start`            | Start the frontend and mock backend          |
| `npm run dev`          | Alias of `npm start`                         |
| `npm test`             | Run all frontend and backend tests           |
| `npm run test:details` | Run tests with detailed frontend output      |
| `npm run test:ui`      | Open the interactive frontend test interface |
| `npm run build`        | Build the production frontend                |

## Additional Documentation

* [`frontend/README.md`](./frontend/README.md)
* [`backend-mock/README.md`](./backend-mock/README.md)
* [`DOCKER.md`](./DOCKER.md)
