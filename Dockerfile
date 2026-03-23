FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm install --production=false

# Copy application code
COPY . .

# Setup database and build
ENV DATABASE_URL="file:/data/b2b.sqlite"
RUN mkdir -p /data
RUN npx prisma generate
RUN npx prisma migrate deploy
RUN npm run build

# Expose port (Railway uses PORT env var)
EXPOSE 3000

# Start script
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
