# Annot8 Docker Architecture

For Docker installation and execution instructions, see the [main repository README](../README.md).

## Purpose

Docker provides a reproducible way to run Annot8 locally.

The Docker image contains:

* the compiled Vue frontend
* the Node.js mock backend
* the sample document metadata
* the annotation schemas
* the document page images

## Build Process

The `Dockerfile` uses a multi-stage build.

### Frontend Build Stage

The first stage:

1. installs the frontend dependencies
2. copies the frontend source code
3. creates the Vite production build

### Runtime Stage

The second stage:

1. copies the mock backend
2. copies the compiled frontend
3. exposes port `3001`
4. starts the Node.js server

The frontend source code and development dependencies are not required at runtime.

## Single-Origin Execution

Inside the container, the Node.js server provides:

* the Vue application
* the mock API
* the annotation schemas
* the document page images

All resources are therefore available from the same origin.

## Port

The application runs on container port:

```text
3001
```

The standard execution command maps it to the same port on the host:

```bash
docker run --rm -p 3001:3001 annot8
```

## Region Persistence

Docker does not store regions.

Regions and assigned annotations are stored by the frontend in the browser's `localStorage`.

Therefore:

* reloading the page retains saved regions
* stopping the container does not clear browser storage
* using a different local port creates a different browser origin
* clearing the browser site data removes the saved regions
* region data is not written to the Docker image or mock backend

## Rebuilding the Image

The Docker image contains the application source available when it was built.

The image only needs to be rebuilt after changing the source code:

```bash
docker build -t annot8 .
```
