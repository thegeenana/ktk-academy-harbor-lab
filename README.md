# Harbor Lab — KTK Academy Kubernetes learning application

Harbor Lab is a fictional note board for learning how an application and its data behave when containers, Pods, nodes, services and database members fail. It is a React interface, a small Node API and PostgreSQL. The domain stays deliberately simple. We chose Postgres because it is already familiar to the course author; the goal is Kubernetes administration rather than learning a new database model.

## Run and test

Two ways to run Harbor Lab. Compose runs the whole lab. `npm test` checks the API on your machine and does not need Postgres.

### Run with Compose

Requirements: Docker with Compose. From the repository root:

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/health/ready
```

`/health/ready` returns `{"status":"ready"}` once Postgres is accepting connections. Open http://localhost:3000, save a note, then restart only the app and refresh:

```bash
docker compose restart harbor
```

The note remains. Postgres keeps its files in the named volume `postgres-data`, and the image is pinned to `postgres:16.15`. The API creates its one table at startup so this first lesson can run before a later lesson introduces migrations.

```bash
docker compose down      # stops the lab and keeps the volume
docker compose down -v   # deletes lab data
```

Use `-v` only when you intend to reset the lab.

Compose publishes Postgres on host port 5432. If that port is already taken, set both values in `.env` (see `.env.example`):

```bash
HARBOR_POSTGRES_PORT=5433
DATABASE_URL=postgres://harbor:harbor@localhost:5433/harbor
```

Compose reads `HARBOR_POSTGRES_PORT`. `npm run dev:api` reads `DATABASE_URL` from that file when the variable is not already set in the environment.

The Compose password `harbor` is a local lab value. Do not reuse it anywhere else.

### Check the running API

With the lab up:

```bash
curl -fsS http://localhost:3000/health/live
curl -fsS http://localhost:3000/health/ready
curl -fsS http://localhost:3000/api/info
curl -fsS -X POST http://localhost:3000/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ada","message":"hello"}'
curl -fsS http://localhost:3000/api/entries
```

Liveness stays `200` even when Postgres is down. Readiness returns `503` until the database can be queried. A saved note comes back from `GET /api/entries`. `/api/info` includes the full instance name, `databaseConnected`, and `noteCount` for every note, including ones older than the 30 shown in the list.

To watch readiness fail and recover, restart the database and poll until the body is `{"status":"ready"}` again:

```bash
docker compose restart postgres
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/live
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/health/ready
```

Expect `200` from liveness. Readiness is `503` while Postgres restarts, then `200`. Refresh the board after it recovers. The note is still there. While the database is down, the board says the notes are still stored in Postgres.

### Run the tests

Requirements: Node.js 20 or newer. The tests use a fake database, so Docker can be stopped.

```bash
npm install
npm test
```

`npm test` runs `server/*.test.js`. The suite covers validation, liveness versus readiness, a lab hold and startup delay, the instance name and note count, rejected and malformed requests, a stored note, and shutdown that waits for an open request. GitHub Actions runs the same command on pushes to `main` and on pull requests. Dependencies are pinned with `package-lock.json`.

### Develop from source

Use this when you are changing the API or the board. Postgres still runs in Compose. The app runs on the host.

```bash
npm install
docker compose up -d postgres
npm run dev:api
```

In a second terminal:

```bash
npm run dev:web
```

Vite is at http://localhost:5173 and proxies `/api` and `/health` to port 3000. Stop the `harbor` Compose service first if it is already using port 3000. With no `.env` file, `npm run dev:api` connects to `localhost:5432`.

## Learning sequence

1. `docs/labs/01-persistence.md`: app restart, DB restart, readiness and volume persistence.
2. `docs/labs/02-replication.md`: PostgreSQL primary/standby model, WAL, lag, failover and backup distinctions. This is a design and observation plan; it has **no runnable replica deployment yet**.
3. A future Kubernetes implementation: run Harbor on a Deployment, then use a PostgreSQL operator to provision separate instances and PVCs across nodes. Test failover and recovery in a disposable cluster.

The broader CKA manuscript is in the companion course package. We do not need replication to begin the Deployment, Service and troubleshooting chapters.

## Repository map

- `app/`: React interface showing notes and observable service state.
- `server/`: HTTP API (`app.js`), process startup and shutdown (`index.js`), validation, health and Postgres access.
- `compose.yaml`: first persistence lesson with a single Postgres member and a volume.
- `docs/labs/`: problem lineage, commands, observations and limits.

## API contract

- `GET /health/live`: the process responds even if Postgres is unavailable.
- `GET /health/ready`: checks Postgres and optional lab readiness conditions; returns 503 on failure.
- `GET /api/info`: version, full instance identity, whether the last database check succeeded, and the total note count.
- `GET /api/entries`: the 30 most recent notes. `noteCount` on `/api/info` is the full total when the board has more than 30.
- `POST /api/entries`: JSON `{ "name": "Ada", "message": "hello" }`. Invalid names or messages return 400.

The API returns 503 when persistence is unavailable. A malformed or oversized JSON body keeps its 4xx status. On `SIGTERM` or `SIGINT` the process finishes open HTTP requests before it closes the database pool. `HARBOR_FORCE_NOT_READY=true` or `HARBOR_STARTUP_DELAY_MS=15000` can be set on a disposable instance to demonstrate probe behaviour. These controls are environment settings, not public endpoints. The Compose password is a local lab value and must not be reused in another environment.

## Why Postgres?

PostgreSQL supports primary/standby streaming replication using WAL. MongoDB's replica set is also a strong teaching example, but it does not provide a general replication advantage that justifies changing the course's familiar database. We can compare MongoDB and Cosmos DB later as optional distributed database studies. The first Kubernetes storage lessons require one persistent database, not a replicated one.

## Naming

- **Repository:** `thegeenana/ktk-academy-harbor-lab`.
- **Course:** KTK Academy Kubernetes Administration Through Problems.
- **Sample application:** Harbor Lab (display title: Harbor).
- **Purpose:** a teaching workload, not a standalone KTK1 or Mapato product.

The word Harbor is already used by the CNCF Harbor container registry. This sample is unrelated. Use the full “Harbor Lab” name in course descriptions and repository metadata to prevent confusion.
