# Start from a Node.js base image
FROM node:18-slim

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

# Install runtime dependencies only, and skip lifecycle scripts like 'prepare'
# This assumes you run 'npm run build' (to compile TypeScript) locally *before* building the Docker image.
RUN npm ci --omit=dev --ignore-scripts

# Copy the already built application code (including your 'build' directory from local compilation)
COPY . .

ENV NODE_ENV production
ENV DEBUG true # Ensure DEBUG is true to see N8nApiClient DEBUG logs

# Adjust if your entry point is different, e.g., build/main.js or based on package.json "main"
CMD ["node", "build/index.js"]
