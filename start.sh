#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy 2>&1
echo "=== Migrations complete ==="

echo "=== Environment ==="
echo "PORT=$PORT"
echo "SHOPIFY_APP_URL=$SHOPIFY_APP_URL"
echo "NODE_ENV=$NODE_ENV"

echo "=== Starting server ==="
exec node server.mjs
