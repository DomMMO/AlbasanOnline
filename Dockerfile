# One container runs everything: the game server serves the built client, the REST API
# and the Colyseus WebSockets on $PORT. The database is external (DATABASE_URL).
FROM node:22-slim

WORKDIR /app

# Install with dev dependencies: Vite builds the client and tsx runs the server.
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --include=dev

COPY . .
RUN npm run build -w client

ENV NODE_ENV=production
CMD ["npm", "start", "-w", "server"]
