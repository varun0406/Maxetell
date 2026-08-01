# Maxwell Trading

Offline-first cloth stock & traceability (web admin + Capacitor Android floor app).

## What you run

From repo root:

```bash
# 1) Install workspace deps
npm install

# 2) API (Fastify + SQLite) — default http://127.0.0.1:3001
cd apps/api && npm run dev

# 3) Web (Vite) — http://localhost:5173
cd apps/web && npm run dev
```

Optional auth: set `AUTH_SECRET` (and optionally seed users via first-admin bootstrap on `/login`).

Fresh DB path: `apps/api` uses `DB_PATH` (default `./data/erp.sqlite`). For a clean Maxwell DB **with demo data**:

```bash
mkdir -p data
rm -f data/maxwell.sqlite data/maxwell.sqlite-*
DB_PATH=./data/maxwell.sqlite npm run dev -w @maxwell/api
```

Demo seed loads when `mx_items` is empty: suppliers, 11 variants, 14 rolls, packings, parcels, job work, and sample delivery challans.

## Capacitor Android (floor device)

**Always run Capacitor commands from `apps/web`**, or use root shortcuts:

```bash
# From repo root (recommended)
npm run cap:sync
npm run cap:open

# First-time only, if android/ folder is missing:
cd apps/web && npm run build && npx cap add android
```

Point the device at your server before build:

```bash
cd apps/web
VITE_API_BASE_URL=https://maxwell.rovark.in/api npm run build
npm run cap:sync
```

## Production (maxwell.rovark.in)

Full guide: [docs/DEPLOY.md](docs/DEPLOY.md)

```bash
# on server, from repo root after first-time nginx/systemd setup:
./scripts/deploy.sh
```

Nginx sample: `docs/nginx.maxwell.rovark.in.conf` · systemd: `docs/maxwell-api.service`

| Area | Route / API |
|---|---|
| Owner dashboard | `/` · `/mx/analytics/*` |
| Masters / rolls | `/masters` `/rolls` · `/mx/*` |
| Cutting (local ID + print + outbox) | `/floor/cutting` |
| Parcels | `/floor/parcel` |
| Godown | `/floor/godown` |
| New challan | `/challans/new` |
| Floor dispatch | `/floor/dispatch` |
| Sync / conflicts | `/device` · `/mx/sync/*` |

Metals ERP routes/pages are removed. Domain tables are `mx_*`.
