# Blip - production deployment

Blip runs self-hosted on a single DigitalOcean droplet. The frontend/API, the
job worker, and Postgres all live on the same box, so the database stays
loopback-only and is never reachable from the internet. Caddy is the only
public surface.

## Topology

```
Internet
   │  :443 / :80
   ▼
Caddy (blip.allensaji.dev) ── reverse_proxy ──> Next.js app (127.0.0.1:3000)
                                                      │
                                                      │ loopback
                                                      ▼
                                          Worker (tsx) ──> Postgres (127.0.0.1:5432)
```

Public ports: 22 (SSH), 80/443 (Caddy). Everything else is loopback-only.

## Prerequisites (on the droplet)

- Node 22 + `tsx` installed globally.
- Docker (for Postgres).
- Caddy (for TLS + reverse proxy).
- The repo cloned at `~/blip`.
- A DNS `A` record pointing `blip.allensaji.dev` at the droplet IP.

## Steps

1. Build the Next.js production bundle:

   ```bash
   cd ~/blip && npm ci && npm run build
   ```

2. Start Postgres:

   ```bash
   sudo cp deploy/compose.yml /opt/blip/compose.yml
   # Fill /opt/blip/.env from deploy/.env.example with real values.
   cd /opt/blip && sudo docker compose up -d
   ```

3. Write the worker env file (host-facing DB URL, not the compose-internal
   `postgres` hostname):

   ```
   # /opt/blip/worker.env (root-owned, mode 600)
   DATABASE_URL=postgres://blip:...@127.0.0.1:5432/blip
   BRIGHTDATA_API_TOKEN=...
   ```

4. Install the systemd units:

   ```bash
   sudo cp deploy/blip-worker.service /etc/systemd/system/
   sudo cp deploy/blip-web.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now blip-worker blip-web
   ```

5. Point Caddy at the app (see `deploy/Caddyfile`), then:

   ```bash
   sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

## Applying the initial schema

The tracked migration lives at `src/db/migrations/`. Apply it once against the
`blip` database:

```bash
sudo docker exec -i blip-postgres-1 psql -U blip -d blip \
  < src/db/migrations/0000_mean_thaddeus_ross.sql
```

## Logs

- Worker: `/var/log/blip-worker.log`
- Web: `/var/log/blip-web.log`
- Caddy access: `/var/log/caddy/blip-access.log`
