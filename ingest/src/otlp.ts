import type { MetricDelta } from "./telemetry.ts";

export type ParsedTrace = {
  traceId: string;
  rootSpanName: string;
  durationMs: number;
  status: "OK" | "ERROR";
  startedAt: string;
  spanJson: string;
};

export type ParsedLog = {
  timestamp: string;
  severity: string;
  body: string;
  traceId: string;
};

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numberish(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return 0;
}

function metricValue(point: Json | undefined): number {
  if (!point) return 0;
  if (point.asInt !== undefined) return numberish(point.asInt);
  if (point.asDouble !== undefined) return numberish(point.asDouble);
  return 0;
}

function histogramSamples(point: Json | undefined): number[] {
  if (!point) return [];
  const bounds = asArray(point.explicitBounds).map(numberish);
  const buckets = asArray(point.bucketCounts).map(numberish);
  const samples: number[] = [];
  for (let i = 0; i < buckets.length; i += 1) {
    const count = buckets[i] ?? 0;
    const bound = bounds[i] ?? bounds[bounds.length - 1] ?? numberish(point.sum);
    for (let n = 0; n < count; n += 1) samples.push(bound);
  }
  if (samples.length === 0 && numberish(point.count) > 0) {
    samples.push(numberish(point.sum) || 0);
  }
  return samples;
}

export function parseMetrics(body: unknown): MetricDelta {
  const root = asRecord(body) ?? {};
  if (!root.resourceMetrics) {
    return {
      requestCount: numberish(root.requestCount),
      errorCount: numberish(root.errorCount),
      latenciesMs: asArray(root.latenciesMs).map(numberish),
      cpuPercent: numberish(root.cpuPercent),
      memoryBytes: numberish(root.memoryBytes)
    };
  }

  let requestCount = 0;
  let errorCount = 0;
  let cpuPercent = 0;
  let memoryBytes = 0;
  const latenciesMs: number[] = [];

  for (const resource of asArray(root.resourceMetrics)) {
    for (const scope of asArray(asRecord(resource)?.scopeMetrics)) {
      for (const metric of asArray(asRecord(scope)?.metrics)) {
        const item = asRecord(metric);
        if (!item) continue;
        const name = String(item.name ?? "");
        const histogramPoints = asArray(asRecord(item.histogram)?.dataPoints).map(asRecord);
        const sumPoints = asArray(asRecord(item.sum)?.dataPoints).map(asRecord);
        const gaugePoints = asArray(asRecord(item.gauge)?.dataPoints).map(asRecord);

        if (name.includes("duration") || name.includes("latency")) {
          for (const point of histogramPoints) latenciesMs.push(...histogramSamples(point));
        }
        if (name.includes("request.count") || name.endsWith("requests")) {
          requestCount += sumPoints.reduce((total, point) => total + metricValue(point), 0);
        }
        if (name.includes("error")) {
          errorCount += sumPoints.reduce((total, point) => total + metricValue(point), 0);
        }
        if (name.includes("cpu")) {
          const raw = gaugePoints.reduce((total, point) => total + metricValue(point), 0);
          cpuPercent = raw <= 1 ? raw * 100 : raw;
        }
        if (name.includes("memory")) {
          memoryBytes = gaugePoints.reduce((total, point) => total + metricValue(point), 0);
        }
      }
    }
  }

  if (requestCount === 0) requestCount = latenciesMs.length;
  return { requestCount, errorCount, latenciesMs, cpuPercent, memoryBytes };
}

function nanoToIso(value: unknown): string {
  const nano = numberish(value);
  if (!nano) return new Date(0).toISOString();
  return new Date(nano / 1_000_000).toISOString();
}

export function parseTraces(body: unknown): ParsedTrace[] {
  const root = asRecord(body) ?? {};
  const traces: ParsedTrace[] = [];
  for (const resource of asArray(root.resourceSpans)) {
    for (const scope of asArray(asRecord(resource)?.scopeSpans)) {
      for (const span of asArray(asRecord(scope)?.spans)) {
        const item = asRecord(span);
        if (!item) continue;
        const start = numberish(item.startTimeUnixNano);
        const end = numberish(item.endTimeUnixNano);
        const statusCode = numberish(asRecord(item.status)?.code);
        traces.push({
          traceId: String(item.traceId ?? ""),
          rootSpanName: String(item.name ?? "span"),
          durationMs: Math.max(0, (end - start) / 1_000_000),
          status: statusCode === 2 ? "ERROR" : "OK",
          startedAt: nanoToIso(item.startTimeUnixNano),
          spanJson: JSON.stringify(item)
        });
      }
    }
  }
  return traces;
}

export function parseLogs(body: unknown): ParsedLog[] {
  const root = asRecord(body) ?? {};
  const logs: ParsedLog[] = [];
  for (const resource of asArray(root.resourceLogs)) {
    for (const scope of asArray(asRecord(resource)?.scopeLogs)) {
      for (const record of asArray(asRecord(scope)?.logRecords)) {
        const item = asRecord(record);
        if (!item) continue;
        logs.push({
          timestamp: nanoToIso(item.timeUnixNano),
          severity: String(item.severityText ?? "INFO"),
          body: String(asRecord(item.body)?.stringValue ?? item.body ?? ""),
          traceId: String(item.traceId ?? "")
        });
      }
    }
  }
  return logs;
}
