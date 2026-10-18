FROM node:22-alpine

WORKDIR /app

COPY --chown=node:node . .

USER root
RUN mkdir -p /app/data \
    && chown -R node:node /app/data \
    && chmod -R u+rwX /app/data

USER node

EXPOSE 3000

CMD ["node", "server.js"]