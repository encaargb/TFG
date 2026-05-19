# MAST Web Annotation Tool

Vue/Vite frontend with a small Node.js mock backend for TFG demonstrations.

## Public Demo

The application is deployed at:

```text
https://tfg-u4as.onrender.com/
```

## Run The Full Mock Application

Install frontend dependencies once:

```bash
cd frontend
npm install
```

Then run the complete mock application from the project root:

```bash
cd mast-web-annotation-tool
npm start
```

This starts both services:

```text
Frontend: http://localhost:5173
Backend mock: http://localhost:3001
```

The frontend calls the mock API:

```text
http://localhost:3001/api/documents/doc1
```

The sample document files are served by the backend from:

```text
backend-mock/public/documents
```

## Production Build

```bash
npm run build
```

The production frontend is generated in:

```text
frontend/dist
```

## Deployment Notes

The current public demo is deployed on Render using the Dockerfile in this repository.

```text
https://tfg-u4as.onrender.com/
```

The mock backend stores regions in memory. Restarting it resets the annotations.

## Tests

```bash
npm test
```

This runs the frontend tests and the mock backend HTTP tests.

## Docker Demo

The project can also run as a single Docker container:

```bash
docker build -t mast-web-annotation-tool .
docker run --rm -p 3001:3001 mast-web-annotation-tool
```

Full Docker instructions are available in [DOCKER.md](./DOCKER.md).
