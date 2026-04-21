# Make Commands Reference

All commands run from the `Electronics_Inventory/` folder.

---

## Quick Start

```bash
make hosts     # one-time: add inventory.local to /etc/hosts
make up        # start everything
make down      # stop everything
```

That's the daily flow. Everything else below is for specific situations.

---

## 1. First-Time Setup (one-time only)

### `make hosts`
Adds entries to `/etc/hosts` so your browser knows where `inventory.local` points. Asks for Mac password (needs sudo).

After this:
- `inventory.local` → your app
- `api.inventory.local` → backend API
- `flower.inventory.local` → Celery monitor

### `make hosts-remove`
Removes those entries from `/etc/hosts`. Only run if you don't want the project on your machine anymore.

---

## 2. Docker Stack (daily use)

### `make up`
**The main command.** Starts all 8 containers:
- postgres (database)
- redis (queue)
- migrate (creates tables, then exits)
- backend (FastAPI)
- worker (Celery worker — runs scrapers)
- beat (Celery scheduler)
- flower (Celery dashboard)
- frontend (Next.js)
- nginx (reverse proxy)

Shows the URLs when it's done. First run takes 3–5 min (builds images); later runs are instant.

### `make down`
Stops and removes all containers. **Data in Postgres is preserved** (stored in Docker volumes).

### `make stop`
Stops containers but keeps them. Faster to restart than `down` + `up`.

### `make restart`
Restarts all running containers. Useful after changing env vars or config files.

### `make rebuild`
Rebuilds Docker images from scratch, then starts. Use after:
- Changing `backend/Dockerfile` or `frontend/Dockerfile`
- Adding new Python packages to `pyproject.toml`
- Adding new npm packages to `package.json`

### `make nuke`
**Destroys everything, including the database.** Use when you want a completely fresh start. Asks no confirmation — be careful.

---

## 3. Viewing Logs

### `make logs`
Tails logs from **all containers** at once. Press `Ctrl+C` to stop.

### `make logs-backend`
Backend only (FastAPI API requests, errors).

### `make logs-frontend`
Frontend only (Next.js dev server, compilation).

### `make logs-worker`
Celery worker logs (scrape execution, failures).

### `make logs-beat`
Celery scheduler logs (when jobs are fired).

### `make logs-db`
Postgres logs.

---

## 4. Inspecting Containers

### `make ps`
Shows all running containers, their status, and which ports are exposed.

### `make shell`
Opens a bash shell **inside the backend container**. Useful for:
- Running one-off Python scripts
- Inspecting files
- Running `alembic` commands manually

Type `exit` to leave.

### `make db-shell`
Opens a `psql` shell connected to the Postgres container. Run SQL directly:
```sql
SELECT * FROM sites;
\dt         -- list all tables
\q          -- quit
```

---

## 5. Database Migrations

Only needed when you change SQLAlchemy models in `backend/app/models/`.

### `make migrate-create m="description here"`
Generates a new migration file by comparing your models to the current database. Example:
```bash
make migrate-create m="add phone field to users"
```
Creates a file in `backend/alembic/versions/`.

### `make migrate-up`
Applies all pending migrations to the database.

### `make migrate-down`
Reverts the last migration (undoes the most recent schema change).

### `make db-reset`
**Destroys the database** and recreates it from scratch with all migrations applied. Use when schema gets messy.

---

## 6. Local Development (without Docker)

Use these only if you don't want to run everything in Docker. Requires Python 3.13 + Node.js installed on your Mac.

### `make install`
Installs backend + frontend dependencies locally.

### `make install-backend`
Python deps via `uv sync`.

### `make install-frontend`
Node deps via `npm install`.

### `make install-playwright`
Installs Playwright's Chromium browser (needed for JS-heavy scrapers like Amazon).

### `make dev`
Runs backend (`:8000`) and frontend (`:3000`) in parallel. Both auto-reload on file changes.

### `make dev-backend`
Backend only — FastAPI with auto-reload.

### `make dev-frontend`
Frontend only — Next.js dev server.

### `make worker`
Run Celery worker locally (not in Docker).

### `make beat`
Run Celery Beat scheduler locally.

---

## 7. Local Database (without Docker stack)

### `make db-up`
Starts only Postgres + Redis in Docker (no backend/frontend). Use when developing locally with `make dev`.

### `make db-down`
Stops them.

### `make db-logs`
Postgres logs.

---

## 8. Flower (Celery Monitor)

### `make flower-up`
Starts only the Flower container. Dashboard at http://flower.inventory.local.

### `make flower-down`
Stops Flower (rest of stack keeps running).

---

## 9. Code Quality

### `make lint`
Runs linters on backend (`ruff`) + frontend (`next lint`).

### `make lint-backend`
Python only.

### `make lint-frontend`
TypeScript/React only.

### `make test`
Runs all tests.

### `make test-backend`
Python tests (`pytest`).

### `make test-frontend`
TypeScript type-check (`tsc --noEmit`).

---

## 10. Production Build

### `make build`
Builds the frontend for production (optimized Next.js bundle).

### `make build-frontend`
Same as above.

---

## 11. Cleanup

### `make clean`
Removes local build artifacts (`.venv`, `node_modules`, `.next`, caches). Doesn't touch Docker.

### `make clean-backend`
Backend only: removes `.venv`, pytest cache, mypy cache, etc.

### `make clean-frontend`
Frontend only: removes `node_modules`, `.next`.

---

## Help

### `make help`
Prints a summary of all commands in your terminal.

---

## Typical Workflows

### Starting work for the day
```bash
make up
make logs-backend    # in another terminal, to watch API
```

### Ending the day
```bash
make down
```

### After pulling new code with changed Python deps
```bash
make rebuild
```

### After changing a SQLAlchemy model
```bash
make migrate-create m="describe your change"
make up              # migrate container auto-applies it
```

### Everything broke, start fresh
```bash
make nuke
make up
```

### Database looks weird, reset it
```bash
make nuke            # wipes data
make up              # fresh DB with all tables
```

### Check what's running
```bash
make ps
```

### Peek at the database
```bash
make db-shell
# Inside psql:
# \dt         -- list tables
# SELECT * FROM sites LIMIT 5;
# \q          -- quit
```

### Debug a failing scrape
```bash
make logs-worker     # watch Celery worker in real time
# Also open http://flower.inventory.local for the visual dashboard
```

---

## URLs (after `make up`)

| URL | What |
|---|---|
| http://inventory.local | Frontend |
| http://inventory.local/admin | Admin panel |
| http://api.inventory.local | Backend API |
| http://api.inventory.local/docs | Swagger API docs |
| http://flower.inventory.local | Celery monitor |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Port 5432 already in use | You have local Postgres running — stop it, or the compose file already uses internal-only networking for DBs |
| Port 80 already in use | You have another web server on port 80 — stop it (`sudo lsof -i :80`) |
| `inventory.local` won't resolve | Run `make hosts` |
| CORS errors in browser | Restart nginx: `docker compose restart nginx` |
| Tables don't exist errors | Run `make migrate-up` or check `make logs` for migrate container |
| Changed Python deps but old ones still load | `make rebuild` |
| Containers crashing, unclear why | `make logs` and look for errors |
| Everything is broken | `make nuke && make up` |
