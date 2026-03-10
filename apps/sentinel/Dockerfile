# SENTINEL — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies using full monorepo lockfile
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/sentinel/package.json ./apps/sentinel/
COPY packages/ui/package.json ./packages/ui/
COPY packages/core/package.json ./packages/core/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
RUN npm ci --ignore-scripts

# Build the app with workspace packages available
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/sentinel/ ./apps/sentinel/
RUN npx turbo run build --filter=@tomachina/sentinel

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/sentinel/public ./apps/sentinel/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/sentinel/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/sentinel/.next/static ./apps/sentinel/.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "apps/sentinel/server.js"]
