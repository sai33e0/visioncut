# VisionCut AI — convenient dev targets

.PHONY: help setup dev dev-frontend dev-backend dev-workers \
        build lint test db-push db-migrate db-studio db-seed \
        db-sql db-sql-reset \
        docker-up docker-down docker-logs health clean

help:
	@echo "VisionCut AI — make targets"
	@echo "  setup           Install all JS + Python deps"
	@echo "  dev             Run frontend + backend together"
	@echo "  dev-frontend    Next.js only (port 3000)"
	@echo "  dev-backend     NestJS only (port 3001)"
	@echo "  dev-workers     All Python workers"
	@echo "  db-push         Apply Prisma schema to local DB"
	@echo "  db-migrate      Create + apply new Prisma migration"
	@echo "  db-sql          Apply all SQL migrations from supabase/migrations/"
	@echo "  db-sql-reset    Drop public schema then re-apply SQL migrations"
	@echo "  db-studio       Open Prisma Studio"
	@echo "  docker-up       Start docker compose stack"
	@echo "  docker-down     Stop docker compose stack"
	@echo "  health          Run health-check script"
	@echo "  clean           Remove node_modules + caches"

setup:
	npm install
	cd backend && npm install
	cd ../frontend && npm install
	cd ../workers && pip install -r requirements.txt

dev:
	npm run dev

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && npm run start:dev

dev-workers:
	cd workers && bash scripts/run_all.sh

build:
	npm run build --workspaces --if-present

lint:
	npm run lint --workspaces --if-present

test:
	npm run test --workspaces --if-present

db-push:
	cd backend && npx prisma db push

db-migrate:
	cd backend && npx prisma migrate dev

db-studio:
	cd backend && npx prisma studio

db-seed:
	cd backend && npx prisma db seed

db-sql:
	node scripts/migrate.js

db-sql-reset:
	node scripts/migrate.js --reset

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

health:
	node scripts/health-check.js

clean:
	npm run clean
