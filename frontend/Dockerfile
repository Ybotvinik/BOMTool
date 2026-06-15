# Development-oriented image: installs deps and runs the Next.js dev server
# with hot reload. Source is bind-mounted via docker-compose.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
