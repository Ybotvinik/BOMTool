#!/usr/bin/env bash
set -euo pipefail

# Wait for Postgres to accept connections before migrating.
python - <<'PY'
import os
import time

import psycopg2

url = os.environ.get("DATABASE_URL", "")
# psycopg2 understands the libpq URL form; strip the SQLAlchemy driver suffix.
dsn = url.replace("postgresql+psycopg2://", "postgresql://")

for attempt in range(30):
    try:
        psycopg2.connect(dsn).close()
        print("Database is ready.")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"Waiting for database ({attempt + 1}/30): {exc}")
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time.")
PY

echo "Running migrations..."
alembic upgrade head

echo "Seeding data..."
python -m app.seed

echo "Starting API..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
