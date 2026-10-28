# The Linkhaven server: device sync, news feed proxy and chart feed.
# Build from the repository root:  docker build -f server/Dockerfile .
FROM node:22-alpine

WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ ./

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8790 \
    SYNC_DATA_DIR=/data

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8790

HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8790)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "linkhaven-server.mjs"]
