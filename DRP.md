# Disaster Recovery Plan

## Architecture context

Before executing any recovery procedure, understand the current data model:

**All service data is in-memory.** There is no database. Runtime data (orders, carts, audit logs, returns, etc.) is lost on container restart. The only persistent source of truth is:

- **SAP** — customers, products, prices, stock, orders (via `sap-integration-service`)
- **GitHub** — source code and Docker images (`ghcr.io`)
- **Hetzner** — the VM disk (OS, `.env`, Docker volumes if any are added later)

This means recovery is primarily about restoring **service availability**, not data.

---

## Severity levels

| Level | Description | Target recovery time |
|-------|-------------|----------------------|
| P1 | Full platform down — no user can access the app | < 30 min |
| P2 | One or more services down — partial functionality lost | < 1 hour |
| P3 | Degraded performance or non-critical service failure | < 4 hours |

---

## Scenario 1: Service is down (P2)

One or more containers crashed or became unhealthy.

```bash
ssh deploy@<server-ip>

# Check which containers are down or unhealthy
docker compose ps

# Check logs for the failing service
docker compose logs --tail 50 <service-name>

# Restart the service
docker compose restart <service-name>

# If restart doesn't help, pull the latest image and redeploy
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull <service-name>
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d <service-name>
```

---

## Scenario 2: Bad deployment — broken image deployed (P1/P2)

A push to `main` deployed a broken image that is causing failures.

### Option A: Rollback via git (preferred)

```bash
# On your local machine — find the last working commit
git log --oneline

# Revert to last known good commit
git revert HEAD --no-edit
git push origin main
# GitHub Actions will rebuild and redeploy the previous working state
```

### Option B: Rollback on the server directly

```bash
ssh deploy@<server-ip>
cd ~/ms-secretos

# Roll back to a previous commit
git log --oneline          # find the last good commit hash
git checkout <commit-hash> -- .
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
```

---

## Scenario 3: Full VM unreachable (P1)

The Hetzner server is not responding (hardware failure, network issue, OOM kill).

### Step 1: Check Hetzner console
Log into the Hetzner Cloud console and check the server status. Use the web console (VNC) to access the server without SSH if needed.

### Step 2: Attempt a hard reboot
From the Hetzner console: Power → Reboot. Wait 2 minutes, then try SSH again.

### Step 3: If the VM is unrecoverable — provision a new one

```bash
# 1. Create a new CX23 (or CX33) on Hetzner with the same SSH key
#    Add to the same firewall rules (ports 22, 80, 443)

# 2. SSH into the new VM and set it up
ssh deploy@<new-ip>
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# 3. Clone the repo and configure
git clone https://github.com/lafrigolet/ms-secretos.git
cd ms-secretos
cp .env.example .env
nano .env   # restore production values from your secure password manager

# 4. Deploy
echo "<github-token>" | docker login ghcr.io -u lafrigolet --password-stdin
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Update HETZNER_HOST secret in GitHub Actions with the new IP
#    GitHub → Settings → Secrets → HETZNER_HOST
```

**Target: < 30 minutes from decision to new server running.**

---

## Scenario 4: JWT_SECRET lost or compromised (P1)

If the `JWT_SECRET` is leaked or lost, all existing tokens must be invalidated immediately.

```bash
ssh deploy@<server-ip>
cd ~/ms-secretos

# Generate a new secret
openssl rand -hex 64

# Update .env
nano .env   # replace JWT_SECRET with the new value

# Restart all services to pick up the new secret
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate
```

**Effect:** All logged-in users will be logged out immediately. They must log in again. This is the intended behavior — it's the only way to invalidate compromised tokens.

---

## Scenario 5: Nginx is down — all routes return 502/504 (P1)

```bash
ssh deploy@<server-ip>
cd ~/ms-secretos

docker compose logs nginx --tail 30
docker compose restart nginx

# If nginx config is corrupted:
git checkout infrastructure/nginx/nginx.conf
docker compose restart nginx
```

---

## Scenario 6: Disk full on the VM (P2)

Docker images and logs can fill the disk over time.

```bash
ssh deploy@<server-ip>

# Check disk usage
df -h

# Clean up unused Docker images, containers, networks
docker system prune -af

# Check and truncate large log files if needed
docker compose logs --tail 0   # doesn't help, but:
# Truncate a specific container log:
sudo truncate -s 0 $(docker inspect --format='{{.LogPath}}' ms-secretos-<service>-1)
```

To prevent recurrence, add log rotation to `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Then restart Docker: `sudo systemctl restart docker`

---

## Key assets to keep secure

Store these in a password manager — recovery is impossible without them:

| Asset | Used for |
|-------|---------|
| `JWT_SECRET` (production value) | Signing and verifying all user tokens |
| Hetzner API token | Managing the VM via API |
| SSH private key (`hetzner-sda`) | Accessing the server |
| GitHub personal access token | Pulling images from ghcr.io on the server |
| SAP credentials (`SAP_USER`, `SAP_PASSWORD`) | Real SAP connectivity |

---

## Health check script

Run this on the server to verify all services are up:

```bash
for port in 3001 3002 3003 3004 3005 3006 3007 3008 3009 3010 3011 3012 3013 3014 3015 3016; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$port/health)
  echo "Port $port: $status"
done
```

All ports should return `200`. Any other code indicates a problem.

---

## Architectural recommendations for future resilience

The current setup has known single points of failure. When the project grows, consider:

- **Add a database** (PostgreSQL) so runtime data survives restarts
- **Enable Hetzner backups** (~20% extra cost) for VM snapshot recovery
- **Add a second VM** with load balancing for zero-downtime deployments
- **Set up uptime monitoring** (e.g. UptimeRobot, free tier) to get alerted on outages before users report them
