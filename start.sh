#!/bin/sh
set -e

echo "=== Running Prisma migrations ==="
npx prisma migrate deploy
echo "=== Migrations done ==="

echo "PORT=$PORT"
echo "SHOPIFY_APP_URL=$SHOPIFY_APP_URL"
echo "NODE_ENV=$NODE_ENV"

echo "=== Starting remix-serve ==="
exec npx remix-serve ./build/server/index.js
