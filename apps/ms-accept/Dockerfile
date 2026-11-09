FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs migrate.mjs ./

USER 1000:1000
EXPOSE 8080
CMD ["node", "server.mjs"]
