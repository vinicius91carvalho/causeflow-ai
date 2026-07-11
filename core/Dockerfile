FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/
RUN pnpm build

FROM base AS widget-build
COPY package.json pnpm-lock.yaml ./
COPY packages/widget/package.json packages/widget/pnpm-lock.yaml ./packages/widget/
RUN pnpm install --filter @causeflow/widget --frozen-lockfile
COPY packages/widget/ ./packages/widget/
RUN pnpm --filter @causeflow/widget build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=widget-build /app/packages/widget/dist ./packages/widget/dist
COPY dashboard/ ./dashboard/
COPY package.json ./

# Bake commit SHA into the image so /health can report it.
# Placed at the end of the runtime stage on purpose: changing GIT_SHA must NOT
# bust the pnpm install cache in the deps/build stages.
ARG GIT_SHA=unknown
ENV APP_VERSION=${GIT_SHA}

EXPOSE 3000
USER node
CMD ["node", "dist/main.js"]
