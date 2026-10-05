# Ingest worker

Accepts OTLP/HTTP JSON at `/v1/metrics`, `/v1/traces`, and `/v1/logs`.

Authorization: `Bearer <ingest-key>` matching a `Service.ingestKeyHash`.

Set `BLOCKS_INGEST_ACCESS_TOKEN` to write rollups into Blocks Data. Without it, the process keeps windows in memory for local experiments (`INGEST_DEMO_KEY`).
