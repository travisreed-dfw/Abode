# ---- build stage: type-check, run the tests and compile the browser code ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.client.json tsconfig.server.json ./
COPY src ./src
COPY test ./test
COPY public ./public
RUN npm run typecheck && npm test && npm run build
# Reinstall with only runtime dependencies (lowdb + steno).
RUN npm ci --omit=dev

# ---- runtime stage: Alpine's own Node package, no npm/yarn/corepack ----
FROM alpine:3.24
RUN apk add --no-cache nodejs
WORKDIR /app
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY src/server ./src/server
COPY src/shared ./src/shared

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=80
ENV DB_PATH=/data/db.json

VOLUME /data
EXPOSE 80

# No curl in the image; use Node's own fetch for the health probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server/main.ts"]
