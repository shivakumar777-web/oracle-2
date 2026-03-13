SHELL := /bin/sh

.PHONY: build up down logs health restart ps test clean

build:
	docker-compose build

up:
	docker-compose up -d

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

clean:
	docker-compose down -v

