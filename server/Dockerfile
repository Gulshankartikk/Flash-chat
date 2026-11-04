FROM node:26-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev --no-audit --no-fund

COPY . .

EXPOSE 5000

ENV NODE_ENV=production
CMD ["node", "server.js"]
