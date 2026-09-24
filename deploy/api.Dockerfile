FROM node:24-alpine AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY tests/e2e/package.json tests/e2e/package.json
RUN npm ci

COPY apps/api apps/api
COPY apps/web apps/web
COPY packages/contracts packages/contracts
COPY tests/e2e tests/e2e
RUN npm run build --workspace=@poker/api

FROM node:24-alpine

WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build --chown=node:node /workspace /workspace
USER node
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@poker/api"]
