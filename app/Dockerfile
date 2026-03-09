FROM node:20-bookworm-slim

WORKDIR /app

COPY public ./public
COPY server ./server

WORKDIR /app/server

RUN npm install --omit=dev

EXPOSE 3000

CMD ["node", "index.js"]
