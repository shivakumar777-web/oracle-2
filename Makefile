SHELL := /bin/sh

.PHONY: build up up-safe preflight down logs health restart ps test clean

# Kill host processes that conflict with Docker ports (80, 6379, 8000)
preflight:
	@echo "Stopping conflicting host services..."
	-sudo systemctl stop nginx 2>/dev/null || true
	-sudo systemctl stop redis-server 2>/dev/null || true
	-sudo systemctl stop manthana.service 2>/dev/null || true
	-pkill -f "uvicorn.*--port 8000" 2>/dev/null || true
	@sleep 2
	@echo "Preflight complete."

build:
	docker-compose build

up:
	docker-compose up -d

up-safe: preflight up

down:
	docker-compose down

logs:
	docker-compose logs -f

health:
	curl http://localhost:8000/health

restart:
	docker-compose restart

ps:
	docker-compose ps

test:
	pytest tests

# Critical path tests (no ML deps) — target 55%+ coverage
test-fast:
	PYTHONPATH=. .venv/bin/pytest tests/ -m "not integration" -v --cov=api --cov=orchestrator --cov=plagiarism_service --cov=services/shared --cov=services/ai-router --cov-report=term-missing --cov-fail-under=55

clean:
	docker-compose down -v

