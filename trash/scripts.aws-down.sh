#!/usr/bin/env bash
# Stop AWS stack (keeps database volume).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose -f docker-compose.aws.yml --env-file .env.aws down
echo "Stopped. Data volumes preserved."
