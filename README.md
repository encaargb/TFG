# Annot8

Annot8 is a browser-based tool related to the field of multimodal document annotation. It allows users to create, edit and classify visual regions on document pages. It was developed as a Bachelor's Degree Final Project focused on frontend document annotation.

## Try Annot8 Online

**[Open the Annot8 live demo](https://tfg-u4as.onrender.com/)**

No installation is required.

### Suggested Evaluation

1. Navigate between document pages.
2. Create a rectangle, polygon and polyline.
3. Select, move and edit the regions.
4. Assign an annotation from the hierarchical schema.
5. Reload the page and confirm that the regions remain available.

## Run Annot8 Locally

### Obtain the Repository

Install [Git](https://git-scm.com/install/) and run:

```bash
git clone https://github.com/encaargb/TFG.git
cd TFG/annot8-web-annotation-tool
```

### Option A — Docker

This option runs the compiled frontend, mock backend, sample document, page images and example annotation schemas in one container.

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), open it and wait until the Docker engine is running.

Check the installation:

```bash
docker version
```

Build the image:

```bash
docker build -t annot8 .
```

Run Annot8:

```bash
docker run --rm -p 3001:3001 annot8
```

Open:

**http://localhost:3001**

Keep the terminal open while using Annot8. Press `Ctrl+C` to stop the container.

The image only needs to be built the first time. To run it again:

```bash
docker run --rm -p 3001:3001 annot8
```

### Option B — Local Development

Install [Node.js 22.12 or later](https://nodejs.org/en/download). npm is included with Node.js.

Install the frontend dependencies:

```bash
npm run setup
```

Start the frontend and mock backend:

```bash
npm start
```

Open:

**http://localhost:5173**

The mock backend runs at:

```text
http://localhost:3001
```

Keep the terminal open while using Annot8. Press `Ctrl+C` to stop both services.

## Run the Tests

Run these commands from `TFG/annot8-web-annotation-tool` after `npm run setup`.

Run all frontend and backend tests:

```bash
npm test
```

Run all frontend and backend tests showing a detailed frontend test report:

```bash
npm run test:details
```

Open the interactive frontend test interface (highly recommended for frontend-focused evaluation):

```bash
npm run test:ui
```

## Data Persistence

Regions and assigned annotations are stored in the browser using `localStorage`:

```text
annot8:documents:<documentId>:regions
```

Saved data:

* remains available after reloading the page
* is local to the current browser and URL
* is not stored by Docker or the mock backend
* is removed when the browser site data is cleared

This persistence mechanism is intended for development and demonstration purposes.

## Main Features

* Multi-page document navigation and zoom
* Rectangle, polygon and polyline creation
* Region selection, movement, resizing and deletion
* Polygon and polyline point editing
* Automatic scrolling during drawing and editing
* Selection of overlapping regions
* Hierarchical annotation assignment
* Automatic browser persistence

## Architecture

Annot8 contains:

* **Frontend:** a Vue 3 application responsible for document visualisation, canvas interactions, regions, annotations and browser persistence.
* **Mock backend:** a read-only Node.js server that provides document metadata, annotation schemas and page images.

The mock backend does not store region changes.

## Technology Stack

* Vue 3
* JavaScript
* Vite
* Konva
* Bootstrap and Bootstrap Vue Next
* QuadTree spatial indexing
* Vitest, Vue Test Utils and jsdom
* Node.js
* Docker
* Render

## Current Scope

The current version demonstrates the frontend annotation workflow using one sample document and predefined annotation schemas.

Authentication, document upload, multi-user collaboration, database persistence and a production backend are outside the current scope.

## Repository Structure

```text
TFG/
├── README.md
└── annot8-web-annotation-tool/
    ├── frontend/
    ├── backend-mock/
    ├── scripts/
    ├── Dockerfile
    ├── DOCKER.md
    ├── package.json
    └── README.md
```

Additional technical details are available in:

* [`annot8-web-annotation-tool/README.md`](./annot8-web-annotation-tool/README.md)
* [`annot8-web-annotation-tool/frontend/README.md`](./annot8-web-annotation-tool/frontend/README.md)
* [`annot8-web-annotation-tool/backend-mock/README.md`](./annot8-web-annotation-tool/backend-mock/README.md)
* [`annot8-web-annotation-tool/DOCKER.md`](./annot8-web-annotation-tool/DOCKER.md)
