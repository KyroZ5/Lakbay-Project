# syntax=docker/dockerfile:1
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install curl for container health checks
RUN apk --no-cache add curl

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Set file permissions for the default non-root node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose API port
EXPOSE 5000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "src/server.js"]
