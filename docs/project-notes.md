# GlinTech BOM Insight — Project Notes

Internal BOM analysis, pricing and procurement tool for GlinTech.

## Overview

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind CSS. RTL Hebrew UI, right-hand sidebar, compact enterprise dashboard.
- **Backend:** Python FastAPI + SQLAlchemy 2.0 + Alembic.
- **Database:** PostgreSQL 16.
- **Local dev:** Docker Compose (`db`, `backend`, `frontend`).
- **File uploads:** local disk for now, abstracted behind `FileStorageService` (future: Google Shared Drive).
- **Auth:** mock current-user selector in the header (future: Google Workspace login). The selected user id is sent to the API via the `X-User-Id` header so actions can be attributed.

> Internal tool. Customers do not log in. No role-based permissions in MVP — all users see all data. All significant actions are recorded in `activity_log`.

## Repository layout

```
/frontend            Next.js app
/backend             FastAPI app
  app/
    main.py          FastAPI app + health endpoint
    config.py        Settings (env-driven)
    database.py      SQLAlchemy engine/session + Base
    deps.py          get_current_user_id (mock auth via X-User-Id)
    models/          ORM models (14 MVP tables)
    schemas/         Pydantic schemas
    routers/         CRUD endpoints (users, customers, projects, bom_versions, bom_lines, activity_log)
    services/
      file_storage.py  FileStorageService abstraction (LocalFileStorage)
      activity.py      log_activity() helper
    seed.py          Seed users / customer / project
  alembic/           Migrations
/docker-compose.yml  PostgreSQL + backend + frontend
/docs                This file
```

## Running locally

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000  (health: http://localhost:8000/health, docs: http://localhost:8000/docs)
- Postgres: localhost:5432 (glintech / glintech)

The backend container automatically waits for Postgres, runs `alembic upgrade head`, seeds data, then starts uvicorn with `--reload`.

## Migrations

Generate a new migration after changing models:

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
docker compose exec backend alembic upgrade head
```

## Database tables (MVP)

`users`, `customers`, `projects`, `bom_versions`, `bom_lines`, `supplier_quotes`,
`supplier_quote_lines`, `pricing_snapshots`, `pricing_lines`, `export_reports`,
`procurement_files`, `procurement_file_lines`, `project_files`, `activity_log`.

CRUD endpoints are currently implemented for: users, customers, projects,
bom_versions, bom_lines, activity_log. The remaining tables have models +
migrations and will get endpoints in later iterations.

## Activity logging

`app/services/activity.py::log_activity(db, user_id, action_type, project_id,
entity_type, entity_name, change_summary)` writes an `activity_log` row. CRUD
routers call it on every create/update/delete.
