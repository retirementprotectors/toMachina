# API Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS builder
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
FROM node:20-alpine AS runner
RUN apk add --no-cache poppler-utils
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy node_modules (includes symlink to packages/core)
COPY --from=builder /app/node_modules ./node_modules
# Copy packages/core so the workspace symlink resolves
COPY --from=builder /app/packages/core ./packages/core
# Copy api dist
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/services/api/package.json ./
# Copy root package.json (needed for workspace resolution)
COPY --from=builder /app/package.json ./

EXPOSE 8080
CMD ["node", "dist/server.js"]
