# ProDash — monorepo-aware Dockerfile
# Build context: repo root (.)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies using full monorepo lockfile
FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/prodash/package.json ./apps/prodash/
COPY apps/riimo/package.json ./apps/riimo/
COPY apps/sentinel/package.json ./apps/sentinel/
COPY packages/ui/package.json ./packages/ui/
COPY packages/core/package.json ./packages/core/
COPY packages/auth/package.json ./packages/auth/
COPY packages/db/package.json ./packages/db/
COPY services/api/package.json ./services/api/
COPY services/bridge/package.json ./services/bridge/
RUN npm ci --ignore-scripts

# Build the app with workspace packages available
FROM base AS builder
WORKDIR /app

# Firebase env vars needed at build time for Next.js static generation
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo run build --filter=@tomachina/prodash

# Production image
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/prodash/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/prodash/.next/static ./apps/prodash/.next/static
COPY --from=builder /app/apps/prodash/public ./apps/prodash/public

USER nextjs
EXPOSE 8080
CMD ["node", "apps/prodash/server.js"]
