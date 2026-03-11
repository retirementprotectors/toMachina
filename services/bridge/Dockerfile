# Bridge Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies using full monorepo lockfile
FROM base AS deps
COPY package.json package-lock.json ./
COPY services/bridge/package.json ./services/bridge/
COPY packages/core/package.json ./packages/core/
RUN npm ci --ignore-scripts

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json turbo.json tsconfig.json ./
COPY services/bridge/ ./services/bridge/
COPY packages/core/ ./packages/core/
RUN npx turbo run build --filter=@tomachina/bridge

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=builder /app/services/bridge/dist ./dist
COPY --from=builder /app/services/bridge/node_modules ./node_modules
COPY --from=builder /app/services/bridge/package.json ./
EXPOSE 8080
CMD ["node", "dist/server.js"]
