FROM node:24-alpine AS build
WORKDIR /src
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY app ./app
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production PORT=3000
WORKDIR /src
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && chown -R node:node /src
COPY --from=build --chown=node:node /src/app/dist ./app/dist
COPY --chown=node:node server ./server
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
