FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

ENV NODE_ENV=development

COPY package*.json ./

RUN npm ci

FROM deps AS build

ENV DATABASE_URL=postgresql://defumar:defumar@localhost:5432/defumar?schema=public

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run prisma:generate
RUN npm run build

FROM base AS runtime

ENV PRISMA_SKIP_POSTINSTALL_GENERATE=true

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node prisma.config.ts ./

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma

USER node

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3333; fetch('http://127.0.0.1:'+port+'/health').then((res)=>{ if(!res.ok) process.exit(1) }).catch(()=>process.exit(1))"]

CMD ["node", "dist/server.js"]
