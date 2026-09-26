# Decision 001 — Use PostgreSQL for Harbor

**Date:** 26 September 2026. **Status:** accepted.

The first Harbor prototype used MongoDB to make a three-member replica set visible in a local lab. We changed the default database to PostgreSQL because the learner already knows it and the CKA course should minimise unrelated database learning. The basic course needs durable storage and observable readiness; it does not depend on a specific document model.

PostgreSQL supports WAL-based streaming replication, standbys and failover designs. The course will teach those separately after the single-instance storage lesson. The current repository has a runnable single-instance Compose setup; a replicated PostgreSQL cluster and Kubernetes operator lab are planned, not yet delivered. MongoDB can be an optional comparison later. Neither database is categorically “better at replication” without defining availability, consistency, operational and workload requirements.
