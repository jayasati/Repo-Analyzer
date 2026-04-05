# ─────────────────────────────────────────────────────────────
# Stage 1: base
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# openssl: Prisma engine on Alpine; git: clone / analysis
RUN apk add --no-cache git python3 make g++ openssl libc6-compat \
    && corepack enable

WORKDIR /app

# ─────────────────────────────────────────────────────────────
# Stage 2: deps
# ─────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
# postinstall runs `prisma generate` — schema must exist before npm ci
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps

# ─────────────────────────────────────────────────────────────
# Stage 3: builder
# ─────────────────────────────────────────────────────────────
FROM deps AS builder

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────
# Stage 4: production
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache git curl openssl libc6-compat

WORKDIR /app

#  use previous stages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json package-lock.json ./

# security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]

# ─────────────────────────────────────────────────────────────
# Development: hot-reload (use with docker-compose.dev.yml)
# ─────────────────────────────────────────────────────────────
FROM deps AS development

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]