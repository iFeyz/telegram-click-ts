#!/bin/sh
set -e

echo "🚀 Starting Telegram Bot..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
sleep 10

# Run Prisma migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed"

# Start the application
echo "🎯 Starting bot application..."
exec "$@"

