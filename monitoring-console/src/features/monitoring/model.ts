export type MetricWindow = {
  ItemId?: string;
  serviceId: string;
  windowStart: string;
  windowSeconds: number;
  requestCount: number;
  errorCount: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  cpuPercent: number;
  memoryBytes: number;
};

export type ServiceRecord = {
  ItemId: string;
  name: string;
  environment: string;
  owner: string;
  sloLatencyMs: number;
  sloErrorRate: number;
};

export type TraceSample = {
  ItemId: string;
  serviceId: string;
  traceId: string;
  rootSpanName: string;
  durationMs: number;
  status: string;
  startedAt: string;
  spanJson: string;
};

export type LogLine = {
  ItemId: string;
  serviceId: string;
  timestamp: string;
  severity: string;
  body: string;
  traceId: string;
};

export function errorRate(window: Pick<MetricWindow, "requestCount" | "errorCount"> | undefined): number {
  if (!window || window.requestCount <= 0) return 0;
  return window.errorCount / window.requestCount;
}

export function latestWindow(windows: MetricWindow[]): MetricWindow | undefined {
  return [...windows].sort((a, b) => Date.parse(b.windowStart) - Date.parse(a.windowStart))[0];
}

export function chartPoints(windows: MetricWindow[], pick: (window: MetricWindow) => number): number[] {
  return [...windows]
    .sort((a, b) => Date.parse(a.windowStart) - Date.parse(b.windowStart))
    .slice(-60)
    .map(pick);
}

export function throughputPerMinute(window: MetricWindow | undefined): number {
  if (!window) return 0;
  const minutes = Math.max(window.windowSeconds / 60, 1 / 60);
  return window.requestCount / minutes;
}

export function filterByTraceId<T extends { traceId: string }>(rows: T[], traceId: string): T[] {
  const wanted = traceId.trim();
  if (!wanted) return rows;
  return rows.filter((row) => row.traceId === wanted);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function sampleWindow(serviceId: string, at = new Date()): MetricWindow {
  const start = new Date(Math.floor(at.getTime() / 60_000) * 60_000).toISOString();
  return {
    serviceId,
    windowStart: start,
    windowSeconds: 60,
    requestCount: 10,
    errorCount: 1,
    latencyP50Ms: 40,
    latencyP95Ms: 80,
    latencyP99Ms: 80,
    cpuPercent: 12,
    memoryBytes: 4096
  };
}
