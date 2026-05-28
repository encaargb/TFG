FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV PORT=3001

COPY backend-mock ./backend-mock
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 3001

CMD ["node", "backend-mock/server.js"]
