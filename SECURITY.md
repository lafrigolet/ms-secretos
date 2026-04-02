  - SE-20 · Rate limiting on auth per user (not just per IP) — your current rate limiting is per IP,
  but a distributed attack from many IPs would bypass it. Locking an account after N failed attempts
  per sapCode is more effective for brute-force protection on login.# Security Plan

This document tracks security controls for the **Secretos del Agua** B2B portal.
Each item has an ID (`SE-XX`) for reference in PRs and issues.

---

## Status

| ID | Control | Priority | Effort | Cost | Status |
|----|---------|----------|--------|------|--------|
| SE-01 | HTTPS + Let's Encrypt | Now | Low | Free | ⬜ Pending |
| SE-02 | Nginx security headers | Now | Low | Free | ✅ Done |
| SE-03 | Hide Nginx version | Now | Low | Free | ✅ Done |
| SE-04 | Fail2ban on VM | Now | Low | Free | ⬜ Pending |
| SE-05 | Disable root SSH + password auth | Now | Low | Free | ⬜ Pending |
| SE-06 | Tenant isolation audit | Now | Medium | Free | ⬜ Pending |
| SE-07 | Cloudflare free tier (WAF + DDoS) | Soon | Low | Free | ⬜ Pending |
| SE-08 | JWT hardening + refresh rotation | Soon | Medium | Free | ⬜ Pending |
| SE-09 | CORS lockdown | Soon | Low | Free | ✅ Done |
| SE-10 | Nginx request size limits | Soon | Low | Free | ✅ Done |
| SE-11 | npm audit + Snyk in CI | Soon | Low | Free | ✅ Done |
| SE-12 | File upload security (HU-39) | Soon | Medium | Free | ⬜ Pending |
| SE-13 | MFA for admin and commercial roles | Soon | Medium | Free | ⬜ Pending |
| SE-14 | Secrets management (Doppler/Vault) | Later | Medium | Free | ⬜ Pending |
| SE-15 | Non-root containers + cap_drop | Later | Medium | Free | ✅ Done |
| SE-16 | Persistent audit log (HU-22) | Later | Medium | Free | ⬜ Pending |
| SE-17 | Docker network segmentation | Later | Medium | Free | ⬜ Pending |
| SE-18 | mTLS on SAP integration | Later | High | Free | ⬜ Pending |
| SE-19 | Pentest with OWASP ZAP | Later | High | Free | ⬜ Pending |
| SE-20 | Per-user login rate limiting (sapCode) | Soon | Medium | Free | ⬜ Pending |

---

## SE-01 · HTTPS + Let's Encrypt

**Why:** All traffic including JWTs is currently sent in plaintext over HTTP.

**How:**
```bash
# On the Hetzner VM
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-configures Nginx and sets up auto-renewal. Also add HTTP → HTTPS redirect in `nginx.conf`:
```nginx
server {
    listen 80;
    return 301 https://$host$request_uri;
}
```

**Requires:** A domain name pointed to the server IP.

---

## SE-02 · Nginx security headers

**Why:** Prevents clickjacking, MIME sniffing, XSS, and enforces HTTPS.

**How:** Add to the `server` block in `nginx.conf`:
```nginx
add_header X-Frame-Options "DENY";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";
add_header Referrer-Policy "strict-origin-when-cross-origin";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
```

---

## SE-03 · Hide Nginx version

**Why:** Prevents attackers from targeting known vulnerabilities in a specific Nginx version.

**How:** Add to the `http` block in `nginx.conf`:
```nginx
server_tokens off;
```

---

## SE-04 · Fail2ban on VM

**Why:** Automatically bans IPs with repeated failed SSH login attempts.

**How:**
```bash
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

Default config already protects SSH. Optionally add a jail for Nginx 4xx errors.

---

## SE-05 · Disable root SSH + password auth

**Why:** Eliminates the two most common SSH attack vectors.

**How:** Edit `/etc/ssh/sshd_config` on the server:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```
```bash
sudo systemctl restart sshd
```

**Prerequisite:** Confirm key-based login works as `deploy` user before applying.

---

## SE-06 · Tenant isolation audit

**Why:** In a B2B portal, one store manager must never access another's data (orders, cart, profile, returns, invoices). This is a critical business requirement.

**How:** Audit every route that returns customer-specific data and verify it filters by `request.user.sub` (the authenticated customer's `sapCode`). Key services to audit:
- `cart-service` — cart is per user
- `order-service` — orders filtered by sapCode
- `returns-service` — returns filtered by sapCode
- `invoice-service` — invoices filtered by sapCode
- `customer-profile-service` — profile access

Write tests that verify customer A cannot access customer B's data.

---

## SE-07 · Cloudflare free tier

**Why:** Adds L7 DDoS protection, WAF (blocks SQLi, XSS, bots), and hides the real server IP. The single biggest security improvement available for free.

**How:**
1. Register domain on Cloudflare
2. Point DNS to Hetzner server IP
3. Enable "Proxied" mode (orange cloud)
4. Set SSL/TLS to "Full (strict)"
5. Enable "Under Attack Mode" if needed

---

## SE-08 · JWT hardening + refresh rotation

**Why:** Long-lived tokens (currently `8h`) increase the window of exposure if a token is stolen.

**How:**
- Shorten access token expiry to `15m`–`1h`
- Add `POST /auth/refresh` endpoint that issues a new access token
- Store refresh tokens server-side with expiry (requires persistent storage)
- Log all token issuance and refresh events to audit-service

---

## SE-09 · CORS lockdown

**Why:** Currently CORS may be open to all origins. Should only allow the production domain.

**How:** In each service's `app.js`:
```js
await app.register(corsPlugin, {
  origin: process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173',
  credentials: true
})
```

Add `ALLOWED_ORIGIN=https://yourdomain.com` to the production `.env`.

---

## SE-10 · Nginx request size limits ✅

**Status:** Implemented in `nginx.conf`.

Controls added:
- `client_max_body_size 1m` — prevents large payload attacks
- `client_body_timeout 10s` — prevents slowloris
- `client_header_timeout 10s`

---

## SE-11 · npm audit + Snyk in CI

**Why:** Catches known vulnerabilities in dependencies before they reach production.

**How:** Add to `.github/workflows/deploy.yml` test job:
```yaml
- name: Audit dependencies
  working-directory: services/${{ matrix.service }}
  run: npm audit --audit-level=high
```

For deeper scanning, add Snyk (free for open source):
```yaml
- uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

---

## SE-12 · File upload security (HU-39)

**Why:** File uploads are a common attack vector (malware upload, path traversal, zip bombs).

**How (when implemented):**
- Validate MIME type server-side (not just extension)
- Limit file size (already covered by SE-10 for nginx)
- Store files outside the webroot
- Scan with ClamAV if handling untrusted files

---

## SE-13 · MFA for admin and commercial roles

**Why:** Admin and commercial accounts have elevated privileges. A stolen password alone should not be enough to access them.

**How:** Implement TOTP (Time-based One-Time Password):
- Library: `otplib` (Node.js)
- Flow: on first login, show QR code to scan with Google Authenticator
- On subsequent logins, require 6-digit code after password
- Store TOTP secret encrypted per user (requires persistent storage)

---

## SE-20 · Per-user login rate limiting (sapCode)

**Why:** Current rate limiting is per IP. A distributed attack from many IPs bypasses it. Locking per `sapCode` after N failed attempts is more effective.

**How:** In `auth-service`, track failed attempts per `sapCode` in memory (or Redis when available):
- Lock account for 15 minutes after 5 consecutive failed attempts
- Return `429 Too Many Requests` with a `retryAfter` field
- Log lockout events to audit-service

---

## SE-14 · Secrets management

**Why:** Production secrets in `.env` files on the server are at risk if the VM is compromised.

**How:** Migrate to **Doppler** (free tier):
- Secrets stored and versioned in Doppler
- Injected at runtime: `doppler run -- docker compose up`
- No secrets on disk
- Full audit log of who accessed what

---

## SE-15 · Non-root containers + cap_drop

**Why:** If a container is compromised, running as root gives the attacker more capabilities.

**How:** Add to each `Dockerfile`:
```dockerfile
USER node
```

Add to `docker-compose.yml` for each service:
```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
```

---

## SE-16 · Persistent audit log (HU-22)

**Why:** `audit-service` currently stores logs in memory — they are lost on restart. A tamper-evident audit log is required for compliance and incident investigation.

**How:** Write audit entries to an append-only file or a database (SQLite as a minimum, PostgreSQL for production).

---

## SE-17 · Docker network segmentation

**Why:** Currently all containers share one network. A compromised container can reach all others.

**How:** Define separate networks in `docker-compose.yml`:
- `frontend-net` — nginx ↔ frontend only
- `backend-net` — all microservices
- `sap-net` — only `sap-integration-service` has external network access

---

## SE-18 · mTLS on SAP integration

**Why:** When `SAP_MODE=odata`, traffic between `sap-integration-service` and the real SAP system should be mutually authenticated.

**How:** Configure client certificates in `sap-integration-service` HTTP client. Only relevant once SAP credentials are active.

---

## SE-19 · Pentest with OWASP ZAP

**Why:** Automated scanning catches vulnerabilities that manual review misses.

**How:**
```bash
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://yourdomain.com \
  -r zap-report.html
```

Run against staging before each major release.

---

## Reporting a vulnerability

If you discover a security vulnerability, do **not** open a public GitHub issue.
Contact the maintainer directly and allow time for a fix before any public disclosure.
