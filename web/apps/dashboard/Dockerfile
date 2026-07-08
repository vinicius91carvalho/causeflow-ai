# CauseFlow Dashboard — open-source local runtime image (AC-044/AC-050).
#
# Multi-stage build mirroring the relay subproject's Dockerfile pattern:
# a builder stage runs `pnpm install --frozen-lockfile` + `next build`, then a
# runtime stage serves the built app with `next start`. No Clerk / Stripe /
# AWS / Sentry / SST runtime dependencies are contacted at boot.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /app

# Build tooling for native deps (e.g. node-gyp fallbacks).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Enable the pnpm version pinned by `packageManager` in package.json.
RUN corepack enable

# Copy the whole workspace (pnpm-lock.yaml guarantees a reproducible install).
COPY . .

RUN pnpm install --frozen-lockfile

# Build the dashboard (turbo builds workspace deps first via ^build).
RUN pnpm --filter @causeflow/dashboard build


FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

# `next start` resolves the Next.js CLI from the hoisted root node_modules.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/dashboard ./apps/dashboard
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/apps/dashboard

EXPOSE 3001

# Bind to 0.0.0.0 so the host can reach the container on the published port.
CMD ["node", "/app/node_modules/.bin/next", "start", "-p", "3001", "-H", "0.0.0.0"]
