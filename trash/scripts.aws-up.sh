#!/usr/bin/env bash
# Start GlinTech BOM Insight on AWS / Linux server.
# Usage: ./scripts/aws-up.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.aws"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.aws.example" "$ENV_FILE"
  echo "Created .env.aws — set PUBLIC_HOST and POSTGRES_PASSWORD, then run again."
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ "${PUBLIC_HOST:-}" == "YOUR_EC2_PUBLIC_IP_OR_DNS" || -z "${PUBLIC_HOST:-}" ]]; then
  echo "Edit .env.aws: set PUBLIC_HOST to this server's public IP or DNS."
  exit 1
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "Missing backend/.env — copy backend/.env.example and add API keys."
  exit 1
fi

echo "PUBLIC_HOST=$PUBLIC_HOST"
echo "App:    http://${PUBLIC_HOST}:3000"
echo "Health: http://${PUBLIC_HOST}:8000/health"
echo ""

docker compose -f docker-compose.aws.yml --env-file "$ENV_FILE" up -d --build

echo ""
echo "Done. Open http://${PUBLIC_HOST}:3000 from allowed networks."
