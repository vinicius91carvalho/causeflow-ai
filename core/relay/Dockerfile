ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json ./
RUN npm install --include=dev
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runtime
LABEL org.opencontainers.image.source="https://github.com/causeflow/causeflow-relay" \
      org.opencontainers.image.title="causeflow-relay" \
      org.opencontainers.image.description="Secure read-only investigation relay for private-network data sources" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.vendor="CauseFlow"

WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER nonroot

EXPOSE 8080
ENTRYPOINT ["/nodejs/bin/node", "dist/index.js"]
