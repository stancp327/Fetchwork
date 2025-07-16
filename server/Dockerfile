FROM node:18.20.4-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 10000

CMD ["node", "index.js"]
