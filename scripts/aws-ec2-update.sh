#!/usr/bin/env bash
# Update alpha on an EC2 instance: pull latest code and rebuild containers.
# Usage (on the server, from repo root):
#   ./scripts/aws-ec2-update.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env.aws"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.aws — copy .env.aws.example and configure first."
  exit 1
fi

if [[ ! -f "$ROOT/backend/.env" ]]; then
  echo "Missing backend/.env"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

echo "Pulling latest code..."
git pull --ff-only

echo "Rebuilding and restarting alpha stack (tag: ${IMAGE_TAG:-alpha})..."
docker compose -f docker-compose.aws.yml --env-file "$ENV_FILE" up -d --build

echo ""
docker compose -f docker-compose.aws.yml --env-file "$ENV_FILE" ps
echo ""
echo "App:    http://${PUBLIC_HOST}:${FRONTEND_PORT:-3000}"
echo "Health: http://${PUBLIC_HOST}:${BACKEND_PORT:-8000}/health"
