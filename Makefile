.PHONY: help install install-backend install-frontend install-playwright \
        up down stop restart rebuild logs ps shell hosts hosts-remove \
        logs-backend logs-frontend logs-worker logs-beat logs-db \
        dev dev-backend dev-frontend \
        db-up db-down db-logs db-shell db-reset \
        migrate migrate-create migrate-up migrate-down \
        worker beat flower flower-up flower-down seed \
        lint lint-backend lint-frontend \
        test test-backend test-frontend \
        build build-frontend \
        clean clean-backend clean-frontend nuke

BACKEND_DIR := backend
FRONTEND_DIR := frontend

help:
	@echo "Electronics Inventory - Make targets"
	@echo ""
	@echo "=== DOCKER-ONLY (recommended — nothing installed locally) ==="
	@echo "  make up                   Start full stack (db, api, worker, beat, flower, frontend)"
	@echo "  make down                 Stop and remove containers"
	@echo "  make stop                 Stop (keep containers)"
	@echo "  make restart              Restart all services"
	@echo "  make rebuild              Rebuild images and start fresh"
	@echo "  make logs                 Tail all logs"
	@echo "  make logs-backend         Tail backend logs only"
	@echo "  make logs-worker          Tail celery worker logs"
	@echo "  make ps                   Show running containers"
	@echo "  make shell                Open bash in backend container"
	@echo "  make nuke                 Destroy everything including data volumes"
	@echo ""
	@echo "=== LOCAL (only if you choose not to use Docker) ==="
	@echo "  make install              Install backend + frontend deps locally"
	@echo "  make install-backend      uv sync backend deps"
	@echo "  make install-frontend     npm install frontend deps"
	@echo "  make install-playwright   Install Playwright browsers"
	@echo ""
	@echo "  make dev                  Run backend + frontend in parallel"
	@echo "  make dev-backend          Run FastAPI (uvicorn) on :8000"
	@echo "  make dev-frontend         Run Next.js dev server on :3000"
	@echo ""
	@echo "  make db-up                Start Postgres + Redis (docker)"
	@echo "  make db-down              Stop Postgres + Redis"
	@echo "  make db-logs              Tail Postgres logs"
	@echo "  make db-shell             Open psql shell"
	@echo "  make db-reset             WIPE db and recreate (destructive)"
	@echo ""
	@echo "  make migrate-create m=\"msg\"  Generate migration from models"
	@echo "  make migrate-up              Apply migrations"
	@echo "  make migrate-down            Revert last migration"
	@echo ""
	@echo "  make lint                 Lint backend + frontend"
	@echo "  make test                 Run all tests"
	@echo "  make build                Build frontend for production"
	@echo "  make clean                Remove build artifacts + venv + node_modules"

# ---------- docker (full stack) ----------
up:
	docker compose up -d --build
	@echo ""
	@echo "Stack is up. Only port 80 is exposed on the host — everything goes through nginx."
	@echo ""
	@echo "  App:       http://inventory.local"
	@echo "  Admin:     http://inventory.local/admin"
	@echo "  API:       http://api.inventory.local"
	@echo "  API docs:  http://api.inventory.local/docs"
	@echo "  Flower:    http://flower.inventory.local"
	@echo ""
	@echo "Postgres and Redis are NOT exposed to your Mac — access via 'make shell' or 'make db-shell'."

hosts:
	@echo "Adding inventory.local entries to /etc/hosts (requires sudo)..."
	@grep -q "inventory.local" /etc/hosts && echo "Already present — skipping." || \
		printf '\n127.0.0.1 inventory.local api.inventory.local flower.inventory.local\n' | sudo tee -a /etc/hosts > /dev/null
	@echo "Done. Verify with: tail -3 /etc/hosts"

hosts-remove:
	@echo "Removing inventory.local entries from /etc/hosts (requires sudo)..."
	@sudo sed -i '' '/inventory.local/d' /etc/hosts
	@echo "Done."

down:
	docker compose down

stop:
	docker compose stop

restart:
	docker compose restart

rebuild:
	docker compose down
	docker compose up -d --build --force-recreate

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

logs-frontend:
	docker compose logs -f frontend

logs-worker:
	docker compose logs -f worker

logs-beat:
	docker compose logs -f beat

logs-db:
	docker compose logs -f postgres

ps:
	docker compose ps

shell:
	docker compose exec backend bash

nuke:
	docker compose down -v --remove-orphans
	@echo "All containers, volumes, and data destroyed."

# ---------- install ----------
install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && uv sync

install-frontend:
	cd $(FRONTEND_DIR) && npm install

install-playwright:
	cd $(BACKEND_DIR) && uv run playwright install chromium

# ---------- dev ----------
dev:
	@echo "Starting backend (:8000) and frontend (:3000)..."
	@trap 'kill 0' INT; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

dev-backend:
	cd $(BACKEND_DIR) && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

# ---------- database ----------
db-up:
	docker compose up -d postgres redis
	@echo "Waiting for Postgres to be ready..."
	@until docker exec electronics_postgres pg_isready -U postgres -d electronics_inventory > /dev/null 2>&1; do sleep 1; done
	@echo "Postgres + Redis are ready."

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

db-shell:
	docker exec -it electronics_postgres psql -U postgres -d electronics_inventory

db-reset:
	docker compose down -v
	docker compose up -d postgres redis
	@until docker exec electronics_postgres pg_isready -U postgres -d electronics_inventory > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate-up

# ---------- celery ----------
worker:
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app worker --loglevel=info -Q celery

beat:
	cd $(BACKEND_DIR) && uv run celery -A app.core.celery_app.celery_app beat --loglevel=info

flower-up:
	docker compose up -d flower
	@echo "Flower UI:  http://localhost:5555"

flower-down:
	docker compose stop flower

# ---------- seed ----------
seed:
	docker compose exec backend uv run python -m scripts.seed

# ---------- migrations ----------
migrate-create:
	@test -n "$(m)" || (echo "Usage: make migrate-create m=\"message\""; exit 1)
	cd $(BACKEND_DIR) && uv run alembic revision --autogenerate -m "$(m)"

migrate-up:
	cd $(BACKEND_DIR) && uv run alembic upgrade head

migrate-down:
	cd $(BACKEND_DIR) && uv run alembic downgrade -1

# ---------- lint ----------
lint: lint-backend lint-frontend

lint-backend:
	cd $(BACKEND_DIR) && uv run ruff check app tests

lint-frontend:
	cd $(FRONTEND_DIR) && npm run lint

# ---------- test ----------
test: test-backend test-frontend

test-backend:
	cd $(BACKEND_DIR) && uv run pytest

test-frontend:
	cd $(FRONTEND_DIR) && npm run typecheck

# ---------- build ----------
build: build-frontend

build-frontend:
	cd $(FRONTEND_DIR) && npm run build

# ---------- clean ----------
clean: clean-backend clean-frontend

clean-backend:
	cd $(BACKEND_DIR) && rm -rf .venv .pytest_cache .ruff_cache .mypy_cache __pycache__ app/__pycache__

clean-frontend:
	cd $(FRONTEND_DIR) && rm -rf node_modules .next out
