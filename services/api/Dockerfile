# API Service — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy monorepo structure needed for this service
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY packages/core/package.json ./packages/core/
COPY services/api/package.json ./services/api/

# Install all workspace deps
RUN npm ci --ignore-scripts

# Copy source and build (core first, then api)
COPY packages/core/ ./packages/core/
COPY services/api/ ./services/api/
RUN npx turbo run build --filter=@tomachina/core && npx turbo run build --filter=@tomachina/api

# Production image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy built output + hoisted node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/api/dist ./dist
COPY --from=builder /app/services/api/package.json ./
COPY --from=builder /app/packages/core/dist ./node_modules/@tomachina/core/dist
COPY --from=builder /app/packages/core/package.json ./node_modules/@tomachina/core/

EXPOSE 8080
CMD ["node", "dist/server.js"]
