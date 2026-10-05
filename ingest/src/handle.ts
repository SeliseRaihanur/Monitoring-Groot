import { matchServiceByBearer } from "./auth.ts";
import { parseLogs, parseMetrics, parseTraces } from "./otlp.ts";
import { aggregateWindow, emptyWindow, shouldKeepLog, shouldSampleTrace, windowStart } from "./telemetry.ts";
import type { BlocksStore, StoredService } from "./store.ts";

export type HandleResult = { status: number; body: Record<string, unknown> };

export async function handleIngest(
  store: BlocksStore,
  input: { path: string; authorization?: string; body: unknown }
): Promise<HandleResult> {
  let services;
  try {
    services = await store.listServices();
  } catch {
    return { status: 502, body: { code: "blocks_write_failed", message: "Ingest could not read services from Blocks. BLOCKS_INGEST_ACCESS_TOKEN must be a Blocks user access token, not the service ingest key." } };
  }
  const service = matchServiceByBearer(services, input.authorization);
  if (!service) {
    return { status: 401, body: { code: "unauthorized", message: "Missing or unknown ingest key" } };
  }

  try {
    if (input.path.endsWith("/v1/metrics")) {
      const delta = parseMetrics(input.body);
      const start = windowStart(new Date());
      const current = (await store.getWindow(service.itemId, start.toISOString())) ?? emptyWindow(service.itemId, start);
      await store.upsertWindow(aggregateWindow(current, delta));
      return { status: 202, body: { accepted: "metrics", serviceId: service.itemId } };
    }

    if (input.path.endsWith("/v1/traces")) {
      const traces = parseTraces(input.body).filter((trace) =>
        shouldSampleTrace({ status: trace.status, durationMs: trace.durationMs, sloLatencyMs: service.sloLatencyMs })
      );
      for (const trace of traces) {
        await store.createTrace({ ...trace, serviceId: service.itemId });
      }
      return { status: 202, body: { accepted: "traces", kept: traces.length, serviceId: service.itemId } };
    }

    if (input.path.endsWith("/v1/logs")) {
      const existing = await store.countLogs(service.itemId);
      const logs = parseLogs(input.body);
      let kept = 0;
      for (const log of logs) {
        if (!shouldKeepLog(existing + kept)) break;
        await store.createLog({ ...log, serviceId: service.itemId });
        kept += 1;
      }
      return { status: 202, body: { accepted: "logs", kept, serviceId: service.itemId } };
    }

    return { status: 404, body: { code: "not_found", message: "Unknown OTLP path" } };
  } catch {
    return { status: 502, body: { code: "blocks_write_failed", message: "Ingest could not write telemetry to Blocks. BLOCKS_INGEST_ACCESS_TOKEN must be a Blocks user access token, not the service ingest key." } };
  }
}

export function summarizeService(service: StoredService): { itemId: string; name: string } {
  return { itemId: service.itemId, name: service.name };
}
