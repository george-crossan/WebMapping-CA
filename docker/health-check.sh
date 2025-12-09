#!/bin/bash

echo "=== Docker Container Health Check ==="

# Check if containers are running
echo "Checking container status..."
docker-compose ps

echo -e "\n=== Service Health Checks ==="

# Check Nginx
echo "Checking Nginx..."
curl -f http://localhost/ > /dev/null 2>&1 && echo "✅ Nginx: Healthy" || echo "❌ Nginx: Unhealthy"

# Check Django
echo "Checking Django..."
curl -f http://localhost:8000/ > /dev/null 2>&1 && echo "✅ Django: Healthy" || echo "❌ Django: Unhealthy"

# Check PostgreSQL
echo "Checking PostgreSQL..."
docker-compose exec postgres pg_isready -U webmapping -d webmapping_db > /dev/null 2>&1 && echo "✅ PostgreSQL: Healthy" || echo "❌ PostgreSQL: Unhealthy"

# Check PgAdmin
echo "Checking PgAdmin..."
curl -f http://localhost:5050/ > /dev/null 2>&1 && echo "✅ PgAdmin: Healthy" || echo "❌ PgAdmin: Unhealthy"

echo -e "\n=== Resource Usage ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
