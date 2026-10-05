import { blocksClient } from "../../lib/blocks/client";
import { field, unwrapPage, withItemId } from "./gateway";
import type { LogLine, MetricWindow, ServiceRecord, TraceSample } from "./model";
import { sampleWindow } from "./model";

const PAGE_SIZE = 100;

function asRow(row: unknown): Record<string, unknown> {
  return (row ?? {}) as Record<string, unknown>;
}

function hydrateService(row: unknown): ServiceRecord {
  const rec = withItemId(asRow(row));
  return {
    ItemId: rec.ItemId,
    name: String(field(rec, "name", "Name") ?? ""),
    environment: String(field(rec, "environment", "Environment") ?? ""),
    owner: String(field(rec, "owner", "Owner") ?? ""),
    sloLatencyMs: Number(field(rec, "sloLatencyMs", "SloLatencyMs") ?? 500),
    sloErrorRate: Number(field(rec, "sloErrorRate", "SloErrorRate") ?? 0.05)
  };
}

function hydrateWindow(row: unknown): MetricWindow {
  const rec = withItemId(asRow(row));
  return {
    ItemId: rec.ItemId,
    serviceId: String(field(rec, "serviceId", "ServiceId") ?? ""),
    windowStart: String(field(rec, "windowStart", "WindowStart") ?? ""),
    windowSeconds: Number(field(rec, "windowSeconds", "WindowSeconds") ?? 60),
    requestCount: Number(field(rec, "requestCount", "RequestCount") ?? 0),
    errorCount: Number(field(rec, "errorCount", "ErrorCount") ?? 0),
    latencyP50Ms: Number(field(rec, "latencyP50Ms", "LatencyP50Ms") ?? 0),
    latencyP95Ms: Number(field(rec, "latencyP95Ms", "LatencyP95Ms") ?? 0),
    latencyP99Ms: Number(field(rec, "latencyP99Ms", "LatencyP99Ms") ?? 0),
    cpuPercent: Number(field(rec, "cpuPercent", "CpuPercent") ?? 0),
    memoryBytes: Number(field(rec, "memoryBytes", "MemoryBytes") ?? 0)
  };
}

function hydrateTrace(row: unknown): TraceSample {
  const rec = withItemId(asRow(row));
  return {
    ItemId: rec.ItemId,
    serviceId: String(field(rec, "serviceId", "ServiceId") ?? ""),
    traceId: String(field(rec, "traceId", "TraceId") ?? ""),
    rootSpanName: String(field(rec, "rootSpanName", "RootSpanName") ?? ""),
    durationMs: Number(field(rec, "durationMs", "DurationMs") ?? 0),
    status: String(field(rec, "status", "Status") ?? ""),
    startedAt: String(field(rec, "startedAt", "StartedAt") ?? ""),
    spanJson: String(field(rec, "spanJson", "SpanJson") ?? "")
  };
}

function hydrateLog(row: unknown): LogLine {
  const rec = withItemId(asRow(row));
  return {
    ItemId: rec.ItemId,
    serviceId: String(field(rec, "serviceId", "ServiceId") ?? ""),
    timestamp: String(field(rec, "timestamp", "Timestamp") ?? ""),
    severity: String(field(rec, "severity", "Severity") ?? ""),
    body: String(field(rec, "body", "Body") ?? ""),
    traceId: String(field(rec, "traceId", "TraceId") ?? "")
  };
}

const services = blocksClient.data.collection<ServiceRecord>("Service", {
  fields: ["name", "environment", "owner", "sloLatencyMs", "sloErrorRate"]
});

const windows = blocksClient.data.collection<MetricWindow>("MetricWindow", {
  fields: [
    "serviceId",
    "windowStart",
    "windowSeconds",
    "requestCount",
    "errorCount",
    "latencyP50Ms",
    "latencyP95Ms",
    "latencyP99Ms",
    "cpuPercent",
    "memoryBytes"
  ]
});

const traces = blocksClient.data.collection<TraceSample>("TraceSample", {
  fields: ["serviceId", "traceId", "rootSpanName", "durationMs", "status", "startedAt", "spanJson"]
});

const logs = blocksClient.data.collection<LogLine>("LogLine", {
  fields: ["serviceId", "timestamp", "severity", "body", "traceId"]
});

export async function createService(input: {
  name: string;
  environment: string;
  owner: string;
  sloLatencyMs: number;
  sloErrorRate: number;
  ingestKeyHash: string;
  ingestKeyId: string;
  otlpEndpointHint: string;
}): Promise<void> {
  await services.create(input);
}

type IngestSnapshot = {
  services: Array<{ itemId: string; name: string }>;
  windows: MetricWindow[];
};

async function fetchIngestSnapshot(): Promise<IngestSnapshot> {
  try {
    const response = await fetch("/ingest/v1/snapshot");
    if (!response.ok) return { services: [], windows: [] };
    const body = (await response.json()) as Partial<IngestSnapshot>;
    return {
      services: Array.isArray(body.services) ? body.services : [],
      windows: Array.isArray(body.windows) ? body.windows.map(hydrateWindow) : []
    };
  } catch {
    return { services: [], windows: [] };
  }
}

export async function listServices(): Promise<ServiceRecord[]> {
  const ingest = await fetchIngestSnapshot();
  let fromBlocks: ServiceRecord[] = [];
  try {
    fromBlocks = unwrapPage(await services.list({ pageNo: 1, pageSize: PAGE_SIZE })).items.map(hydrateService);
  } catch {
    fromBlocks = [];
  }
  const extra = ingest.services
    .filter((service) => !fromBlocks.some((row) => row.ItemId === service.itemId))
    .map((service) => ({
      ItemId: service.itemId,
      name: service.name,
      environment: "local-ingest",
      owner: "ingest",
      sloLatencyMs: 500,
      sloErrorRate: 0.05
    }));
  return [...fromBlocks, ...extra];
}

export async function sendSampleWindow(serviceId: string): Promise<void> {
  const window = sampleWindow(serviceId);
  await windows.create({
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
  });
}

export async function listWindows(serviceId: string): Promise<MetricWindow[]> {
  const ingest = await fetchIngestSnapshot();
  let fromBlocks: MetricWindow[] = [];
  try {
    const page = unwrapPage(
      await windows.list({ pageNo: 1, pageSize: PAGE_SIZE, filter: { serviceId }, sort: { windowStart: -1 } })
    );
    fromBlocks = page.items.map(hydrateWindow).filter((row) => !serviceId || row.serviceId === serviceId);
    if (fromBlocks.length === 0 && page.totalCount > 0) {
      fromBlocks = unwrapPage(await windows.list({ pageNo: 1, pageSize: PAGE_SIZE, sort: { windowStart: -1 } }))
        .items.map(hydrateWindow)
        .filter((row) => row.serviceId === serviceId);
    }
  } catch {
    fromBlocks = [];
  }
  const local = ingest.windows.filter((row) => row.serviceId === serviceId);
  return [...fromBlocks, ...local];
}

export async function listTraces(serviceId: string): Promise<TraceSample[]> {
  const page = unwrapPage(
    await traces.list({ pageNo: 1, pageSize: PAGE_SIZE, filter: { serviceId }, sort: { startedAt: -1 } })
  );
  return page.items.map(hydrateTrace).filter((row) => !serviceId || row.serviceId === serviceId);
}

export async function listLogs(serviceId: string): Promise<LogLine[]> {
  const page = unwrapPage(
    await logs.list({ pageNo: 1, pageSize: PAGE_SIZE, filter: { serviceId }, sort: { timestamp: -1 } })
  );
  return page.items.map(hydrateLog).filter((row) => !serviceId || row.serviceId === serviceId);
}
