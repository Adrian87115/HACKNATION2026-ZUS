# Node part of ZUSia: the NestJS backend and the built frontend served by Caddy (HTTPS + reverse proxy).
#   docker build -f deploy/node.Dockerfile --target backend .
#   docker build -f deploy/node.Dockerfile --target web --build-arg VITE_SITE_URL=https://example.pl .

FROM node:22-slim AS deps
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
COPY packages/engine/package.json packages/engine/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
# shared workspace packages (@zus/engine, @zus/shared) are compiled first – both apps import their dist/
RUN pnpm --filter "./packages/*" build

# ---------------------------------------------------------------- backend
FROM deps AS backend-build
RUN pnpm --filter backend build

FROM node:22-slim AS backend
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=backend-build /app /app
WORKDIR /app/backend
# engine parameters, document library and feature switches set in the admin panel
VOLUME /app/backend/data
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------- frontend
FROM deps AS web-build
# public origin – canonical URLs, sitemap and social tags are pre-rendered with it
ARG VITE_SITE_URL
ARG VITE_NOINDEX=false
ENV VITE_SITE_URL=$VITE_SITE_URL VITE_NOINDEX=$VITE_NOINDEX
RUN pnpm --filter frontend build

FROM caddy:2 AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/frontend/dist /srv
