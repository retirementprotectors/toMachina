# API Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM us-central1-docker.pkg.dev/claude-mcp-484718/tomachina/node:20-alpine AS builder
WORKDIR /app

# Copy monorepo structure needed for this service
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY services/api/package.json ./services/api/

# Install all workspace deps
RUN npm ci --ignore-scripts

# Copy source and build (core first, then api)
COPY packages/core/ ./packages/core/
COPY services/api/ ./services/api/
RUN npx turbo run build --filter=@tomachina/core && npx turbo run build --filter=@tomachina/api

# Production image — preserve monorepo symlink structure
FROM us-central1-docker.pkg.dev/claude-mcp-484718/tomachina/node:20-alpine AS runner
RUN apk add --no-cache poppler-utils
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Preserve full monorepo node_modules tree (hoisted deps + workspace symlinks)
COPY --from=builder /app/node_modules ./node_modules
# Copy packages/core (dist + package.json) so workspace symlink resolves
COPY --from=builder /app/packages/core ./packages/core
# Copy api service with its own node_modules (catches non-hoisted deps)
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/package.json ./services/api/
COPY --from=builder /app/services/api/node_modules ./services/api/node_modules
# Copy root package.json (needed for workspace resolution)
COPY --from=builder /app/package.json ./

EXPOSE 8080
WORKDIR /app/services/api
CMD ["node", "dist/server.js"]
