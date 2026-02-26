#!/bin/bash

# ImmoAlert Deployment Script
# Usage: ./deploy.sh [environment]
# Environments: production, staging

set -e

ENVIRONMENT=${1:-production}
echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found. Please create one from .env.example"
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Build and start services
echo "📦 Building Docker images..."
docker-compose build --no-cache

echo "🚀 Starting services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check health
echo "🏥 Checking service health..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend health check failed"
fi

if curl -s http://localhost:80 > /dev/null; then
    echo "✅ Frontend is healthy"
else
    echo "⚠️  Frontend health check failed"
fi

echo "🎉 Deployment complete!"
echo "📱 Frontend: http://localhost"
echo "🔧 Backend API: http://localhost:3000"
