# Lab 02 — From one Postgres instance to primary and standby

**Status:** course design for the next infrastructure slice. The current Compose file runs one Postgres instance; this document does not claim an executable replica cluster.

**Story:** Harbor survives a process restart, but its sole database host becomes unavailable. Daniel asks for another copy of the data that can take over.

## Mental model

Postgres writes changes to its write-ahead log (WAL). A standby receives and replays WAL from the primary. In asynchronous streaming replication, a committed transaction may not yet have reached the standby. Synchronous replication can wait for acknowledgement from selected standbys, trading latency and availability for a stronger durability condition. A failover requires promoting a standby and directing clients to the new primary; an operator can automate parts of this in Kubernetes. Kubernetes gives each instance its own Pod identity and persistent volume; PostgreSQL handles data replication. A PVC alone does not copy data.

## Planned Kubernetes experiment

1. Deploy Harbor with a single Postgres instance on one PVC. Save a note; replace the database Pod; verify the note remains.
2. Deploy an operator-managed PostgreSQL cluster with a primary and two standbys, one PVC per instance. Spread them over separate worker nodes. Record Pod placement, PVC/PV bindings and replication status.
3. Write a distinct note. Stop the primary's node in a disposable cluster. Observe how a standby is promoted, how the write endpoint changes, whether the app reconnects, and how long requests fail.
4. Bring the failed instance back. Observe resynchronisation and verify all acknowledged writes. Measure replay lag before testing reads from a standby.
5. Delete a note deliberately. Observe that deletion also replicates; restore a backup to a separate test database to recover it.
6. Repeat with insufficient voting/healthy instances and discuss the limit of availability. Do not promise zero loss or zero downtime from the word “replicated.”

**Evidence:** before/after topology, individual PVCs, WAL receive/replay position, elapsed client error interval, final note IDs, and a tested backup recovery point. Record the operator version and exact storage class when this lab is implemented.

**Boundary:** three instances on one Docker host are still one host failure domain. A Kubernetes cluster needs storage and scheduling capable of spreading instances; even separate Pods on the same physical host would not prove node resilience. Replication is not a backup.

References: https://www.postgresql.org/docs/current/warm-standby.html and https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
