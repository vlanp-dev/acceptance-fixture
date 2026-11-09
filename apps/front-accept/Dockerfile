FROM node:22-alpine

WORKDIR /app
COPY server.mjs ./

USER 1000:1000
EXPOSE 3000
CMD ["node", "server.mjs"]
