# CauseFlow Website — open-source local runtime image (AC-044/AC-050).
#
# Multi-stage build mirroring the relay subproject's Dockerfile pattern:
# a builder stage runs `pnpm install --frozen-lockfile` + `next build`, then a
# runtime stage serves the built app with `next start`. No Clerk / Stripe /
# AWS / Sentry / SST runtime dependencies are contacted at boot.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY . .

# Bake redirect destinations (next.config.mjs reads these at build time).
# Runtime env alone cannot change permanent redirects already compiled into the image.
ARG NEXT_PUBLIC_DASHBOARD_URL=http://localhost:3001
ARG NEXT_PUBLIC_DEPLOYMENT_STAGE=development
ENV NEXT_PUBLIC_DASHBOARD_URL=$NEXT_PUBLIC_DASHBOARD_URL
ENV NEXT_PUBLIC_DEPLOYMENT_STAGE=$NEXT_PUBLIC_DEPLOYMENT_STAGE

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @causeflow/website build


FROM node:${NODE_VERSION}-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/website ./apps/website
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

WORKDIR /app/apps/website

EXPOSE 3000

CMD ["node", "/app/node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
