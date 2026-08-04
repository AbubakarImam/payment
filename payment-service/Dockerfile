# ============================================================
# Payment Service — multi-stage production Dockerfile
# ============================================================
#
# Prisma's query/schema engine binaries are native executables that link
# against OpenSSL — `node:*-alpine` images don't include it by default,
# so every stage that runs `prisma generate`/`prisma migrate` or loads
# `@prisma/client` at runtime needs `apk add openssl` first. Skipping
# this produces a cryptic "Could not parse schema engine response" error
# instead of a clear "missing library" one.

# ---- deps: install all deps once, cached across builds ----
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# ---- build: compile TypeScript + generate Prisma client ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- prod-deps: production-only node_modules ----
FROM node:20-alpine AS prod-deps
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- runtime: minimal final image ----
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app

# Run as a non-root user
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

USER nestjs

EXPOSE 3000 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
