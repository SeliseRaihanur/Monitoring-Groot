import { createBlocksClient } from "@seliseblocks/client";
import type { BlocksStore, StoredLog, StoredService, StoredTrace } from "./store.ts";
import type { MetricWindow } from "./telemetry.ts";

type Page<T> = { items: T[] };

function unwrapPage<T>(result: unknown): Page<T> {
  const root = (result ?? {}) as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  if (Array.isArray(data.items)) return { items: data.items as T[] };
  for (const value of Object.values(data)) {
    if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
      return { items: (value as { items: T[] }).items };
    }
  }
  return { items: (Array.isArray(data.data) ? data.data : []) as T[] };
}

export function createBlocksStore(): BlocksStore {
  const accessToken = process.env.BLOCKS_INGEST_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("BLOCKS_INGEST_ACCESS_TOKEN is required for the Blocks store");
  }

  const client = createBlocksClient({
    accessToken: () => accessToken,
    apiUrl: process.env.BLOCKS_API_URL || "https://blocksapi.slsblx.com",
    xBlocksKey: process.env.BLOCKS_X_BLOCKS_KEY || "Da80f8fc3eeda4fa8a198c7961e6971f5"
  });

  const services = client.data.collection<StoredService & { ItemId?: string }>("Service", {
    fields: ["name", "ingestKeyHash", "sloLatencyMs"]
  });
  const windows = client.data.collection<MetricWindow & { ItemId?: string }>("MetricWindow", {
    fields: ["serviceId", "windowStart", "windowSeconds", "requestCount", "errorCount", "latencyP50Ms", "latencyP95Ms", "latencyP99Ms", "cpuPercent", "memoryBytes"]
  });
  const traces = client.data.collection("TraceSample", {
    fields: ["serviceId", "traceId", "rootSpanName", "durationMs", "status", "startedAt", "spanJson"]
  });
  const logs = client.data.collection("LogLine", {
    fields: ["serviceId", "timestamp", "severity", "body", "traceId"]
  });

  return {
    async listServices() {
      const page = unwrapPage<StoredService & { ItemId?: string; itemId?: string }>(
        await services.list({ pageNo: 1, pageSize: 100 })
      );
      return page.items.map((item) => ({
        itemId: item.ItemId || item.itemId || "",
        name: item.name,
        ingestKeyHash: item.ingestKeyHash,
        sloLatencyMs: Number(item.sloLatencyMs || 500)
      }));
    },
    async listWindows(serviceId) {
      const page = unwrapPage<MetricWindow & { ItemId?: string }>(
        await windows.list({
          pageNo: 1,
          pageSize: 100,
          filter: serviceId ? { serviceId } : undefined,
          sort: { windowStart: -1 }
        })
      );
      return page.items;
    },
    async getWindow(serviceId, windowStartIso) {
      const page = unwrapPage<MetricWindow & { ItemId?: string }>(
        await windows.list({ pageNo: 1, pageSize: 5, filter: { serviceId, windowStart: windowStartIso } })
      );
      return page.items[0];
    },
    async upsertWindow(window) {
      const current = await this.getWindow(window.serviceId, window.windowStart);
      const payload = {
        serviceId: window.serviceId,
        windowStart: window.windowStart,
        windowSeconds: window.windowSeconds,
        requestCount: window.requestCount,
        errorCount: window.errorCount,
        latencyP50Ms: window.latencyP50Ms,
        latencyP95Ms: window.latencyP95Ms,
        latencyP99Ms: window.latencyP99Ms,
        cpuPercent: window.cpuPercent,
        memoryBytes: window.memoryBytes
      };
      if (current && "ItemId" in current && current.ItemId) {
        await windows.update(String(current.ItemId), payload);
        return;
      }
      await windows.create(payload);
    },
    async createTrace(trace: StoredTrace) {
      await traces.create(trace);
    },
    async countLogs(serviceId: string) {
      const result = await logs.list({ pageNo: 1, pageSize: 1, filter: { serviceId } });
      const root = (result ?? {}) as Record<string, unknown>;
      const data = (root.data ?? root) as Record<string, unknown>;
      return Number(data.totalCount ?? 0);
    },
    async createLog(log: StoredLog) {
      await logs.create(log);
    }
  };
}

