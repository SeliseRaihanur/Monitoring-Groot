## Brief — local-monitoring: Reusable backend monitoring

Type: feature · Work: current · Target: current · Risky: no · Source: chat
**Outcome** — Operators see per-service latency, throughput, error rate, CPU, and memory plus sampled traces/logs. Does not replace Datadog at high cardinality.

| AC | Given / when / then | Observable failure |
|---|---|---|
| AC-1 | Valid ingest bearer when posting metrics | 202 and a MetricWindow rollup |
| AC-2 | Unknown bearer | 401 unauthorized |
| AC-3 | ERROR or slow trace | kept; fast OK dropped |
| AC-4 | Log cap 500 | further lines rejected |
| AC-5 | Dashboard selectors | error rate, latest window, trace filter |

**Assumptions** — Auth/roles: clouduser operators, **needs human** to complete first login from the activation mail. Ingest writes with BLOCKS_INGEST_ACCESS_TOKEN. owner is a team label, not an email.
