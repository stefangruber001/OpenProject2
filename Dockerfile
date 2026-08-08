# =============================================================================
# Production image for apps/web.
#
# Two targets, both built from this one file:
#   --target runtime  → the Next.js server (this is what runs in production)
#   --target migrate  → a throwaway container that runs `prisma migrate deploy`
#
# Full Debian bookworm, not -slim and not Alpine, on purpose. Prisma needs
# OpenSSL: `-slim` ships no libssl at all, so the engine falls back to an
# openssl-1.1.x build and dies with a bare "Schema engine error" — verified by
# building it that way first. The full image carries OpenSSL 3.0.x already,
# which means no apt-get in any stage: the build works unchanged behind a
# corporate proxy or an air-gapped mirror, and there is one less thing for an
# IT provider to debug. The extra image size is irrelevant on an 80 GB VPS.
#
# The health check is a Node one-liner rather than curl, so nothing else is
# needed either.
#
# NODE_IMAGE exists so the build works where Docker Hub is mirrored:
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm .
# =============================================================================
ARG NODE_IMAGE=node:22-bookworm

# --- build -------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
RUN corepack enable

# The whole context in one go, deliberately. Listing 26 workspace manifests to
# win a cache layer would break silently every time someone adds a capability —
# a trap that only springs after handover. The repo is small; correctness wins.
COPY . .

# --ignore-scripts because @repo/db's postinstall runs `prisma generate`, which
# we do explicitly below so a failure names itself.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store \
 && pnpm install --frozen-lockfile --ignore-scripts

# NEXT_PUBLIC_* is inlined at build time, so the public URL must be known here,
# not at run time. The deploy workflow passes the real one.
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm --filter @repo/db exec prisma generate
RUN pnpm --filter web build

# --- migrate -----------------------------------------------------------------
# Deliberately independent of the workspace: a pinned Prisma CLI and the schema,
# nothing else. `docker compose run --rm migrate` is then a one-liner an IT
# provider can read without knowing what pnpm or Turborepo are.
FROM ${NODE_IMAGE} AS migrate
WORKDIR /migrate
RUN npm install -g prisma@6.3.0 && npm cache clean --force
COPY packages/db/prisma ./prisma
# DATABASE_URL comes from the environment at run time.
CMD ["prisma", "migrate", "deploy", "--schema", "./prisma/schema.prisma"]

# --- runtime -----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app


ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The commit this image was built from, readable from OUTSIDE the machine via
# /api/health. There is already an OCI revision label, but reading it requires
# SSH and Docker; the question "is the code I just pushed the code that is
# answering?" needs to be answerable from a laptop, over the public address, in
# one request. Every time that has been guessed at instead, the guess was wrong.
ARG BUILD_REVISION="unknown"
ENV BUILD_REVISION=${BUILD_REVISION}

# Never run the server as root.
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# `output: standalone` with outputFileTracingRoot at the repo root mirrors the
# monorepo layout, so server.js lands at apps/web/server.js.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static     ./apps/web/.next/static
# `public/` is NOT traced into the standalone output — Next requires it to be
# copied by hand. It holds the ERP workspace UI (a copy of site/, generated at
# build time by scripts/sync-workspace.mjs), which is the whole point of this
# server: without it /workspace/erp.html is a 404 and the box serves an API
# nobody can use.
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public            ./apps/web/public

# Tenant specs are read from disk at request time. The standalone bundle traces
# imported modules only, so these YAML files have to be copied explicitly, and
# TENANTS_DIR points at them — in the container there is no repo above the app
# to walk up to. Without this the app starts healthy and fails every tenant
# request.
COPY --from=build --chown=nextjs:nodejs /repo/tenants ./tenants
ENV TENANTS_DIR=/app/tenants

USER nextjs
EXPOSE 3000

# The app's own probe, which also reports whether the database is reachable.
# Node's global fetch, so the image needs no curl.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
