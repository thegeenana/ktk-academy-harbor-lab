# Lab 01 — A restart is not data loss

**Story:** Maya releases a new Harbor process. Amina asks whether yesterday's notes will still exist.

1. Predict what happens when only the app container restarts.
2. Start `docker compose up --build -d`; add a note in the browser.
3. Run `docker compose restart harbor`; reload the page.
4. Run `docker compose restart postgres`; wait for `/health/ready` to recover; reload.
5. Inspect `docker compose ps`, `docker volume ls`, and `docker compose config`.

**Explain:** the app process has no durable local state. Postgres stores its files under `/var/lib/postgresql/data` in a named volume. Restarting the database container reuses that volume. A volume is not a backup, and losing the Docker host can lose this lab's data. Do not use `docker compose down -v` as a restart test—it intentionally destroys the named volume.

**Evidence:** a note's ID and text before and after each restart; ready endpoint before, during and after a database interruption. Explain why liveness stays 200 while readiness may become 503.
