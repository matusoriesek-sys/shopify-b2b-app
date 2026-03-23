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

# Create data directory for SQLite
RUN mkdir -p /data

# Set runtime env defaults
ENV DATABASE_URL="file:/data/b2b.sqlite"
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# At runtime: migrate DB then start
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
