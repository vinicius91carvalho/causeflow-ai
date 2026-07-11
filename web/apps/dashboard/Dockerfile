# CauseFlow Dashboard — open-source local runtime image (AC-044/AC-050/AC-053).
#
# Multi-stage build mirroring the relay subproject's Dockerfile pattern:
# a builder stage runs `pnpm install --frozen-lockfile` + `next build`, then a
# runtime stage serves the built app with `next start`. No Clerk / Stripe /
# AWS / Sentry / SST runtime dependencies are contacted at boot.
#
# The runtime stage keeps the full workspace + pnpm so AC-053 can run
# `docker exec causeflow-dashboard pnpm turbo check-types|lint|test|build`.

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

# Native tooling + pnpm so in-container turbo gates (AC-053) can run.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# Full workspace from the builder — required for `pnpm turbo *` inside the
# running container (packages/*, turbo.json, biome.json, vitest configs).
COPY --from=builder /app /app

WORKDIR /app/apps/dashboard

EXPOSE 3001

# Bind to 0.0.0.0 so the host can reach the container on the published port.
CMD ["node", "/app/node_modules/.bin/next", "start", "-p", "3001", "-H", "0.0.0.0"]
