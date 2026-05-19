FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm install --prefix server && npm install --prefix client
COPY server server
COPY client client
RUN npm run build --prefix client && npm run build --prefix server

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations
COPY --from=builder /app/client/dist ./client/dist
RUN cd server && npm install --omit=dev
WORKDIR /app/server
EXPOSE 5000
CMD ["node", "dist/index.js"]
