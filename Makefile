.PHONY: help build up down restart logs shell migrate collectstatic superuser clean

# Default target
help:
    @echo "Available commands:"
    @echo "  build        - Build all Docker containers"
    @echo "  up           - Start all services"
    @echo "  down         - Stop all services"
    @echo "  restart      - Restart all services"
    @echo "  logs         - View logs from all services"
    @echo "  shell        - Open Django shell"
    @echo "  migrate      - Run database migrations"
    @echo "  collectstatic - Collect static files"
    @echo "  superuser    - Create Django superuser"
    @echo "  clean        - Remove containers and volumes"

# Build containers
build:
    docker-compose build

# Start services
up:
    docker-compose up -d

# Stop services
down:
    docker-compose down

# Restart services
restart: down up

# View logs
logs:
    docker-compose logs -f

# Open Django shell
shell:
    docker-compose exec web python manage.py shell

# Run migrations
migrate:
    docker-compose exec web python manage.py migrate

# Collect static files
collectstatic:
    docker-compose exec web python manage.py collectstatic --noinput

# Create superuser
superuser:
    docker-compose exec web python manage.py createsuperuser

# Clean everything
clean:
    docker-compose down -v
    docker system prune -f
    docker volume prune -f

# Development setup
dev-setup: build up migrate collectstatic superuser
    @echo "Development environment ready!"
    @echo "Application: http://localhost"
    @echo "PgAdmin: http://localhost:5050"

# Production deployment
prod-deploy:
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Update containers
update:
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d