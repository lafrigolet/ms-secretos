# Deployment Guide

## Overview

CI/CD is handled by GitHub Actions. On every push to `main`:

1. Tests run for all 16 services in parallel
2. If all pass, Docker images are built and pushed to GitHub Container Registry (`ghcr.io`)
3. The Hetzner VM pulls the new images and restarts the containers

```
git push origin main
        ↓
GitHub Actions: test (all services in parallel)
        ↓
GitHub Actions: build & push images to ghcr.io
        ↓
SSH into Hetzner → docker compose pull + up -d
```

## Infrastructure

- **VM**: Hetzner CX23 (2 vCPU, 4GB RAM) — upgrade to CX33 (8GB) if needed
- **Registry**: GitHub Container Registry (`ghcr.io/lafrigolet/`)
- **Compose files**:
  - `docker-compose.yml` — local dev, builds from source
  - `docker-compose.prod.yml` — production override, pulls images from ghcr.io

## GitHub secrets required

Set these in the repository: Settings → Secrets and variables → Actions

| Secret | Value |
|--------|-------|
| `HETZNER_HOST` | Server IP address |
| `HETZNER_USER` | `deploy` |
| `HETZNER_SSH_KEY` | Contents of the private SSH key |

`GITHUB_TOKEN` is injected automatically by GitHub Actions — no setup needed.

## First-time server setup

### 1. Create the server

On Hetzner Cloud:
- Type: CX23 (or CX33 for more headroom)
- Image: Debian 12
- SSH key: add your public key
- Firewall: allow ports 22, 80, 443 only

### 2. Configure the server (cloud-config or manually)

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add deploy user to docker group
sudo usermod -aG docker deploy
```

### 3. Clone the repo and configure environment

```bash
ssh deploy@<server-ip>
git clone https://github.com/lafrigolet/ms-secretos.git
cd ms-secretos
cp .env.example .env
nano .env   # set NODE_ENV=production, JWT_SECRET, SAP_MODE, SAP credentials
```

### 4. Initial deploy

```bash
echo "<github-token>" | docker login ghcr.io -u <github-username> --password-stdin
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

After this, all future deploys happen automatically via GitHub Actions on push to `main`.

## Production `.env` values

```bash
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
SAP_MODE=odata          # or 'stub' if SAP is not yet connected
SAP_BASE_URL=<sap-url>
SAP_USER=<sap-user>
SAP_PASSWORD=<sap-password>
```

## Manual deploy (without CI)

```bash
ssh deploy@<server-ip>
cd ~/ms-secretos
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
docker image prune -f
```

## Monitoring

Each service exposes a `/health` endpoint. Check all at once:

```bash
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3013 3014 3015 3016; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | grep -o '"status":"[^"]*"' || echo "unreachable"
done
```

## Scaling

The current setup runs all services on a single VM with Docker Compose. To scale:

- **Vertical**: upgrade Hetzner plan (CX23 → CX33 → CX43) — takes under a minute, no data loss
- **Horizontal**: migrate to Docker Swarm or Kubernetes — requires rearchitecting the compose setup
