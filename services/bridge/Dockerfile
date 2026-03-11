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

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy built output + hoisted node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/bridge/dist ./dist
COPY --from=builder /app/services/bridge/package.json ./
# Copy @tomachina/core with source (main points to src/index.ts)
COPY --from=builder /app/packages/core/dist ./node_modules/@tomachina/core/dist
COPY --from=builder /app/packages/core/src ./node_modules/@tomachina/core/src
COPY --from=builder /app/packages/core/package.json ./node_modules/@tomachina/core/

EXPOSE 8080
CMD ["node", "dist/server.js"]
