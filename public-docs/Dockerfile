# syntax=docker/dockerfile:1
#
# CauseFlow public docs — open-source local runtime image.
#
# Multi-stage build:
#   - builder: installs the Mintlify CLI (`mint`) and produces a static export
#     of the MDX site via `mint export`. No account, no deploy token, no
#     network dependency on the Mintlify hosting SaaS.
#   - runtime: a minimal node:22-alpine image that serves the exported static
#     site with the export's bundled `serve.js` (pure Node `http` module,
#     zero runtime dependencies, zero outbound SaaS calls).
#
# The runtime image carries no .env, no MINTLIFY_* env vars, and no Mintlify
# account credentials. The only runtime env var is PORT (default 3000).

FROM node:22-alpine AS builder
RUN apk add --no-cache unzip \
 && npm install -g mint@4.2.666
WORKDIR /build
COPY . .
RUN mint export --output export.zip --telemetry false \
 && mkdir -p /out \
 && unzip -q export.zip -d /out

FROM node:22-alpine AS runtime
WORKDIR /app
ENV PORT=3000
COPY --from=builder /out/ ./
EXPOSE 3000
CMD ["node", "serve.js"]
