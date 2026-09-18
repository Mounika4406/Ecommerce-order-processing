FROM node:20-alpine

WORKDIR /app

# Install curl for health check
RUN apk add --no-cache curl

# Copy package manifests
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy source code and configurations
COPY src/ ./src/
COPY .env.example ./.env

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
