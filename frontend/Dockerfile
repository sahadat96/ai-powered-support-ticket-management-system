FROM node:24-alpine AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN mkdir -p public && npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
