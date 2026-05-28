# Running The Application With Docker

This project can be run as a single Docker container. The image builds the Vue frontend and serves it from the mock backend, so the application is available from one URL.

## Public Demo

The deployed demo is available at:

```text
https://tfg-u4as.onrender.com/
```

## Requirements

Install and open Docker Desktop:

```text
https://www.docker.com/products/docker-desktop/
```

Check that Docker is available:

```bash
docker --version
```

## Build The Image

From the `annot8-web-annotation-tool` directory:

```bash
docker build -t annot8-web-annotation-tool .
```

This command:

- installs the frontend dependencies
- builds the Vue/Vite frontend
- copies the frontend build into the final image
- copies the mock backend and sample documents

## Run The Container

```bash
docker run --rm -p 3001:3001 annot8-web-annotation-tool
```

Open:

```text
http://localhost:3001
```

The frontend, mock API, and document images are served from the same container.

## Stop The Container

Press:

```text
Ctrl+C
```

## Useful URLs

Application:

```text
http://localhost:3001
```

Backend health check:

```text
http://localhost:3001/health
```

Document API:

```text
http://localhost:3001/api/documents/doc1
```

Sample page image:

```text
http://localhost:3001/documents/doc1/pages/pg1.jpeg
```

## Important Limitation

The backend is a mock service. Region annotations are stored in memory, so they are reset when the container stops.
