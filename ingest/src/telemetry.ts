export const DEFAULT_WINDOW_SECONDS = 60;
export const DEFAULT_LOG_CAP = 500;

export type MetricDelta = {
  requestCount: number;
  errorCount: number;
  latenciesMs: number[];
  cpuPercent: number;
  memoryBytes: number;
};

export type MetricWindow = MetricDelta & {
  serviceId: string;
  windowStart: string;
  windowSeconds: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
};

export function windowStart(at: Date, windowSeconds = DEFAULT_WINDOW_SECONDS): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

export function percentile(samples: number[], rank: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index] ?? 0;
}

export function aggregateWindow(existing: MetricWindow, delta: MetricDelta): MetricWindow {
  const latenciesMs = [...existing.latenciesMs, ...delta.latenciesMs];
  return {
    ...existing,
    requestCount: existing.requestCount + delta.requestCount,
    errorCount: existing.errorCount + delta.errorCount,
    latenciesMs,
    latencyP50Ms: percentile(latenciesMs, 0.5),
    latencyP95Ms: percentile(latenciesMs, 0.95),
    latencyP99Ms: percentile(latenciesMs, 0.99),
    cpuPercent: delta.cpuPercent || existing.cpuPercent,
    memoryBytes: delta.memoryBytes || existing.memoryBytes
  };
}

export function emptyWindow(serviceId: string, start: Date, windowSeconds = DEFAULT_WINDOW_SECONDS): MetricWindow {
  return {
    serviceId,
    windowStart: start.toISOString(),
    windowSeconds,
    requestCount: 0,
    errorCount: 0,
    latenciesMs: [],
    latencyP50Ms: 0,
    latencyP95Ms: 0,
    latencyP99Ms: 0,
    cpuPercent: 0,
    memoryBytes: 0
  };
}

export function shouldSampleTrace(input: { status: string; durationMs: number; sloLatencyMs: number }): boolean {
  return input.status === "ERROR" || input.durationMs > input.sloLatencyMs;
}

export function shouldKeepLog(existingCount: number, cap = DEFAULT_LOG_CAP): boolean {
  return existingCount < cap;
}
