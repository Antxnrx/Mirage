# Mirage server: indexer, send guard, guarded exits, web UI.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY server/package.json server/
RUN npm ci --ignore-scripts
COPY packages packages
COPY server server
RUN cd packages/core && npx tsc -p .
ENV HOST=0.0.0.0 PORT=8787 DATA_DIR=./data
EXPOSE 8787
WORKDIR /app/server
CMD ["npx", "tsx", "src/main.ts"]
