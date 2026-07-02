FROM node:20-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY . .

ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN yarn build

FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
