FROM node:18-slim

# Install OpenSSL (required by Prisma)
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies
RUN npm install --production=false

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the Remix app
RUN npm run build

# Verify build output exists
RUN ls -la build/server/ && echo "Build OK"

# Create data directory for SQLite
RUN mkdir -p /data

# Set runtime env defaults
ENV DATABASE_URL="file:/data/b2b.sqlite"
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start script with proper error handling
COPY <<'STARTSCRIPT' /app/start.sh
#!/bin/sh
set -e
echo "=== Running Prisma migrations ==="
npx prisma migrate deploy
echo "=== Migrations done, starting server ==="
echo "PORT=$PORT"
echo "SHOPIFY_APP_URL=$SHOPIFY_APP_URL"
exec npx remix-serve ./build/server/index.js
STARTSCRIPT

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
