FROM node:22-alpine
WORKDIR /app
COPY server.mjs .
ENV TEST_APP_PORT=5190
ENV TEST_APP_HOST=0.0.0.0
EXPOSE 5190
HEALTHCHECK --interval=5s --timeout=3s --retries=6 \
  CMD wget -qO- http://127.0.0.1:5190/health || exit 1
CMD ["node", "server.mjs"]
