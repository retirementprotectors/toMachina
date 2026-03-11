# Bridge Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo structure needed for this service
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
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

# Copy node_modules (includes symlink to packages/core)
COPY --from=builder /app/node_modules ./node_modules
# Copy packages/core so the workspace symlink resolves
COPY --from=builder /app/packages/core ./packages/core
# Copy bridge dist
COPY --from=builder /app/services/bridge/dist ./dist
COPY --from=builder /app/services/bridge/package.json ./
# Copy root package.json (needed for workspace resolution)
COPY --from=builder /app/package.json ./

EXPOSE 8080
CMD ["node", "dist/server.js"]
