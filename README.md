# Harbor Lab — KTK Academy Kubernetes learning application

Harbor Lab is a fictional note board for learning how an application and its data behave when containers, Pods, nodes, services and database members fail. It is a React interface, a small Node API and PostgreSQL. The domain stays deliberately simple. We chose Postgres because it is already familiar to the course author; the goal is Kubernetes administration rather than learning a new database model.

## Start locally

Requirements: Docker with Compose. At the repository root:

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/health/ready
```

Open http://localhost:3000, save a note, then run `docker compose restart harbor` and refresh. The note should remain because Postgres stores it in the named volume `postgres-data`. `docker compose down` retains named volumes; `docker compose down -v` **deletes lab data**. Never use `-v` unless you intend to reset the lab. The API creates its one table at startup to keep this first lesson runnable; a later application lesson can introduce versioned migrations.

For local source development: `npm install`, `docker compose up -d postgres`, `npm run dev:api`, and in another terminal `npm run dev:web`. Vite runs at http://localhost:5173 and proxies `/api` and `/health` to port 3000. Stop the `harbor` Compose service if it occupies port 3000. Dependencies are pinned with `package-lock.json`.

## Learning sequence

1. `docs/labs/01-persistence.md`: app restart, DB restart, readiness and volume persistence.
2. `docs/labs/02-replication.md`: PostgreSQL primary/standby model, WAL, lag, failover and backup distinctions. This is a design and observation plan; it has **no runnable replica deployment yet**.
3. A future Kubernetes implementation: run Harbor on a Deployment, then use a PostgreSQL operator to provision separate instances and PVCs across nodes. Test failover and recovery in a disposable cluster.

The broader CKA manuscript is in the companion course package. We do not need replication to begin the Deployment, Service and troubleshooting chapters.

## Repository map

- `app/`: React interface showing notes and observable service state.
- `server/`: HTTP API, validation, health and Postgres access.
- `compose.yaml`: first persistence lesson with a single Postgres member and a volume.
- `docs/labs/`: problem lineage, commands, observations and limits.

## API contract

- `GET /health/live`: the process responds even if Postgres is unavailable.
- `GET /health/ready`: checks Postgres and optional lab readiness conditions; returns 503 on failure.
- `GET /api/info`: version and instance identity.
- `GET /api/entries`: most recent 30 notes.
- `POST /api/entries`: JSON `{ "name": "Ada", "message": "hello" }`.

The API returns 503 if persistence is unavailable. `HARBOR_FORCE_NOT_READY=true` or `HARBOR_STARTUP_DELAY_MS=15000` can be set on a disposable instance to demonstrate probe behaviour. These controls are environment settings, not public endpoints. The Compose password is a local lab value and must not be reused in another environment.

## Why Postgres?

PostgreSQL supports primary/standby streaming replication using WAL. MongoDB's replica set is also a strong teaching example, but it does not provide a general replication advantage that justifies changing the course's familiar database. We can compare MongoDB and Cosmos DB later as optional distributed database studies. The first Kubernetes storage lessons require one persistent database, not a replicated one.

## Naming

- **Repository:** `thegeenana/ktk-academy-harbor-lab`.
- **Course:** KTK Academy Kubernetes Administration Through Problems.
- **Sample application:** Harbor Lab (display title: Harbor).
- **Purpose:** a teaching workload, not a standalone KTK1 or Mapato product.

The word Harbor is already used by the CNCF Harbor container registry. This sample is unrelated. Use the full “Harbor Lab” name in course descriptions and repository metadata to prevent confusion.
