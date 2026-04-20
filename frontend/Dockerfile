# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install deps first so later code changes don't bust the layer cache.
COPY package*.json ./
RUN npm install

COPY . .

# Production build by default. dev mode is still available via
#   docker compose run --rm frontend npm run dev
# or by overriding `command:` in docker-compose.override.yml.
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000

# Compose overrides this with `sh -c "npm run build && npm run start"`;
# CMD here is the sensible default when run without compose.
CMD ["sh", "-c", "npm run build && npm run start"]
