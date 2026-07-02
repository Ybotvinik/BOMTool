# BOMTool

BOMTool is a full-stack BOM pricing and procurement application.

The canonical application is split into:

- `frontend/` - Next.js user interface.
- `backend/` - FastAPI backend, database migrations, seed data, and supplier API integrations.
- `docker-compose.yml` - production-style deployment using prebuilt container images.
- `.env.example` - template for deployment configuration.
- `build-images.bat` - Windows helper for building frontend and backend images.
- `push-images-ghcr.bat` - Windows helper for logging in to GHCR and pushing images.
- `trash/` - old Docker/env/deployment files kept only for reference.

The root `src/` app is the older prototype. The deployable MVP is `frontend/` plus `backend/`.

## Runtime Architecture

The production Compose stack runs:

- `db` - Postgres.
- `backend` - FastAPI on the internal Docker network.
- `frontend` - Next.js on the internal Docker network.
- `gateway` - Nginx public entrypoint.

The browser talks to one public origin:

```text
http://SERVER_HOST/
```

The gateway routes:

```text
/       -> frontend:3000
/api    -> backend:8000
/docs   -> backend:8000
/health -> backend:8000
```

This avoids needing a different frontend image for each server IP. The frontend uses same-origin `/api` calls by default.

## Configuration

Copy the template and edit it:

```bash
cp .env.example .env
```

Important settings:

```env
IMAGE_TAG=latest
BACKEND_IMAGE=ghcr.io/OWNER_OR_ORG/bomtool-backend
FRONTEND_IMAGE=ghcr.io/OWNER_OR_ORG/bomtool-frontend

POSTGRES_USER=glintech
POSTGRES_PASSWORD=change-this-password
POSTGRES_DB=glintech
POSTGRES_PORT=5432

HTTP_PORT=80

DIGIKEY_CLIENT_ID=
DIGIKEY_CLIENT_SECRET=
DIGIKEY_ENV=sandbox
MOUSER_API_KEY=
TI_CLIENT_ID=
TI_CLIENT_SECRET=
```

What can be changed:

- `BACKEND_IMAGE` and `FRONTEND_IMAGE` can point to any registry/repository, not only GHCR.
- `IMAGE_TAG` can be `latest`, a version like `v1.0.0`, or a commit SHA.
- `HTTP_PORT` is defined in the root `.env` file and controls the public app port on the remote machine. `docker-compose.yml` uses it in the gateway mapping: `${HTTP_PORT:-80}:80`. If `HTTP_PORT` is not defined or is empty, Docker Compose uses the default value `80`.
- `POSTGRES_*` controls the database credentials and exposed host port.
- Supplier API keys control Digi-Key, Mouser, and TI pricing integrations.
- `DIGIKEY_ENV` should match the Digi-Key credentials: `sandbox` or `production`.
- `BACKEND_CORS_ORIGINS` is mainly for direct browser access to the backend during non-gateway/local setups.

Do not commit real `.env` files or supplier credentials.

## Build Production Images

On a Windows machine with Docker installed, run:

```bat
build-images.bat
```

This builds both images using the image names and tag defined at the top of the script.

Equivalent manual commands:

```bash
docker build -t ghcr.io/OWNER_OR_ORG/bomtool-backend:TAG ./backend
docker build -t ghcr.io/OWNER_OR_ORG/bomtool-frontend:TAG ./frontend
```

If the registry, repository names, or tag change, update the script variables or use manual commands with the desired names.

## Push Images To GHCR

Create a GitHub token with package permissions:

- `write:packages` to push images.
- `read:packages` to pull private images.

Then run:

```bat
push-images-ghcr.bat
```

The script prompts for GitHub username and token, logs in to `ghcr.io`, and pushes the backend and frontend images.

Equivalent manual commands:

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
docker push ghcr.io/OWNER_OR_ORG/bomtool-backend:TAG
docker push ghcr.io/OWNER_OR_ORG/bomtool-frontend:TAG
```

If the GHCR packages are private, the remote deployment machine must also log in to GHCR before pulling.

## Deploy On A Remote Machine

The remote machine only needs:

```text
docker-compose.yml
.env
```

Copy them to the server, for example:

```bash
scp docker-compose.yml user@SERVER_HOST:/path/to/bom-tool/
scp .env user@SERVER_HOST:/path/to/bom-tool/
```

SSH into the server:

```bash
ssh user@SERVER_HOST
cd /path/to/bom-tool
```

If images are private, log in to the registry:

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Pull and start:

```bash
docker compose pull
docker compose up -d
```

Open the app:

```text
http://SERVER_HOST/
```

If `HTTP_PORT` is not `80`, include the port:

```text
http://SERVER_HOST:HTTP_PORT/
```

For example, if the remote `.env` contains:

```env
HTTP_PORT=8080
```

open:

```text
http://SERVER_HOST:8080/
```

## Updating A Deployment

Build and push new images with the chosen tag, then update the remote `.env` if the tag changed:

```env
IMAGE_TAG=new-tag
```

Apply the update:

```bash
docker compose pull
docker compose up -d
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f gateway
```

## Persistent Data

Compose creates named volumes:

- `db_data` - Postgres data.
- `uploads_data` - uploaded files.

Do not remove these volumes unless you intentionally want to delete application data.
