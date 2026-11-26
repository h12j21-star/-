FROM docker:28-cli AS docker-cli

FROM node:22-alpine
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
WORKDIR /app
COPY server.js index.html modules.json ./
ENV TESTBED_DIR=/testbed
EXPOSE 7000
CMD ["node", "/app/server.js"]
