# Bridge Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo structure needed for this service
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY services/bridge/package.json ./services/bridge/

# Install all workspace deps
RUN npm ci --ignore-scripts

# Copy source and build (core first, then bridge)
COPY packages/core/ ./packages/core/
COPY services/bridge/ ./services/bridge/
RUN npx turbo run build --filter=@tomachina/core && npx turbo run build --filter=@tomachina/bridge

# Production image — preserve monorepo symlink structure
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Preserve full monorepo node_modules tree (hoisted deps + workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules
# Copy packages/core (dist + package.json) so workspace symlink resolves
COPY --from=builder /app/packages/core ./packages/core
# Copy bridge service with its own node_modules (catches non-hoisted deps)
COPY --from=builder /app/services/bridge/dist ./services/bridge/dist
COPY --from=builder /app/services/bridge/package.json ./services/bridge/
COPY --from=builder /app/services/bridge/node_modules ./services/bridge/node_modules
# Copy root package.json (needed for workspace resolution)
COPY --from=builder /app/package.json ./

EXPOSE 8080
WORKDIR /app/services/bridge
CMD ["node", "dist/server.js"]
