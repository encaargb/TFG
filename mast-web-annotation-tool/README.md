# MAST Web Annotation Tool

Vue/Vite frontend with a small Node.js mock backend for TFG demonstrations.

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

For a public demo, deploy the frontend and backend as two services:

- Frontend: Netlify or Vercel, using `frontend` as the project directory, `npm run build` as the build command, and `dist` as the publish/output directory.
- Backend mock: Render, Railway, Fly.io, or another Node host, using `backend-mock` as the project directory and `npm start` as the start command.
- Frontend environment variable: `VITE_API_BASE_URL=https://your-backend-url`.

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
