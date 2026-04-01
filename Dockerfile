# ─────────────────────────────────────────────────────────────
# Stage 1: base
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

RUN apk add --no-cache git python3 make g++ \
    && corepack enable

WORKDIR /app

# ─────────────────────────────────────────────────────────────
# Stage 2: deps
# ─────────────────────────────────────────────────────────────
FROM base AS deps

COPY package.json package-lock.json ./
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

RUN apk add --no-cache git curl

WORKDIR /app

# ✅ use previous stages
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

# security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]