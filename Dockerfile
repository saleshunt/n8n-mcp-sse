# Stage 1: Build the application
FROM node:18-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:18-slim
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/build ./build

EXPOSE 8000

# Command to run Supergateway, which in turn runs the n8n-mcp-server via stdio.
# Railway will set the PORT environment variable.
# Supergateway will use this PORT.
# node build/index.js will inherit environment variables like N8N_API_URL, N8N_API_KEY, DEBUG.
CMD ["sh", "-c", "npx -y supergateway --stdio \"node build/index.js\" --port ${PORT:-8000} --healthEndpoint /healthz --cors --logLevel info"]
