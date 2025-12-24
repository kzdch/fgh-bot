FROM mcr.microsoft.com/playwright:v1.43.1-jammy

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
