# Monitoring Groots

Reusable backend monitoring on SELISE Blocks. Any service emits OpenTelemetry; the ingest worker rolls that into 1-minute windows and sampled traces/logs; the dashboard reads Blocks Data.

## Pieces

- `monitoring-console/` — Blocks web app (OIDC login, service list, charts, traces, logs)
- `ingest/` — OTLP/HTTP worker (`/v1/metrics`, `/v1/traces`, `/v1/logs`)
- `monitoring-console/blocks/data/` — `Service`, `MetricWindow`, `TraceSample`, `LogLine`

## Run the dashboard

```bash
cd monitoring-console
npm install
npm run cert
npm run dev
```

Open `https://dcazxh-eoeuv.slsblx.com:5173`. Hosts must map that name to `127.0.0.1`. Sign in as the invited operator.

## Run ingest

```bash
cd ingest
npm install
set BLOCKS_INGEST_ACCESS_TOKEN=<operator access token>
set BLOCKS_X_BLOCKS_KEY=Da80f8fc3eeda4fa8a198c7961e6971f5
npm start
```

Register a service in the dashboard, copy the one-time ingest key, then:

```bash
curl -X POST http://127.0.0.1:4318/v1/metrics ^
  -H "Authorization: Bearer <ingest-key>" ^
  -H "Content-Type: application/json" ^
  -d "{\"requestCount\":10,\"errorCount\":1,\"latenciesMs\":[20,40,80],\"cpuPercent\":12,\"memoryBytes\":4096}"
```

Point any language OTel SDK or Collector at `http://127.0.0.1:4318` with the same bearer key.
