# Problem lineage and teaching map

| Learner sees | Question | Mechanism | Proof |
|---|---|---|---|
| App restarted, notes remain | Where are writes kept? | Postgres named volume | Same note ID after restart |
| Database stopped, app live but unready | What is process health versus service readiness? | Separate liveness and database-backed readiness | 200 live, 503 ready |
| Primary and standbys (future lab) | Why does each need storage and identity? | WAL streaming and per-instance volumes | Replication status and PVCs |
| Primary fails (future lab) | What promotes a standby and redirects clients? | Operator/failover mechanism | New primary and successful write |
| A recent write is missing on standby | What does async lag mean? | WAL receive/replay | Compare LSN positions |
| Accidental delete | Does replication undo mistakes? | Deletion reaches standby | Need for backup |
| Multiple Pods on one host | What failure is still shared? | Failure domains | Separate-node lab |

The runnable first slice is the React/API/Postgres Compose app. The operator-managed Kubernetes replication exercise remains to be implemented and tested. The CKA fundamentals can use the HTTP application before introducing this database detail.
