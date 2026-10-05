import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseLogs, parseMetrics, parseTraces } from "../src/otlp.ts";

describe("parseMetrics", () => {
  it("accepts the thin fixture contract", () => {
    const parsed = parseMetrics({
      requestCount: 3,
      errorCount: 1,
      latenciesMs: [12, 40, 90],
      cpuPercent: 11,
      memoryBytes: 4096
    });
    assert.deepEqual(parsed, {
      requestCount: 3,
      errorCount: 1,
      latenciesMs: [12, 40, 90],
      cpuPercent: 11,
      memoryBytes: 4096
    });
  });

  it("reads OTLP JSON counters gauges and histograms", () => {
    const parsed = parseMetrics({
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: "http.server.request.duration",
                  histogram: { dataPoints: [{ count: "4", explicitBounds: [50, 100], bucketCounts: ["1", "2", "1"] }] }
                },
                { name: "http.server.request.count", sum: { dataPoints: [{ asInt: "4" }] } },
                { name: "http.server.request.errors", sum: { dataPoints: [{ asInt: "1" }] } },
                { name: "process.cpu.utilization", gauge: { dataPoints: [{ asDouble: 0.42 }] } },
                { name: "process.memory.usage", gauge: { dataPoints: [{ asInt: "8192" }] } }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(parsed.requestCount, 4);
    assert.equal(parsed.errorCount, 1);
    assert.equal(parsed.cpuPercent, 42);
    assert.equal(parsed.memoryBytes, 8192);
    assert.ok(parsed.latenciesMs.length >= 1);
  });
});

describe("parseTraces", () => {
  it("flattens OTLP spans into samples", () => {
    const traces = parseTraces({
      resourceSpans: [
        {
          scopeSpans: [
            {
              spans: [
                {
                  traceId: "aabb",
                  name: "GET /orders",
                  startTimeUnixNano: "1000000000",
                  endTimeUnixNano: "1250000000",
                  status: { code: 2 }
                }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(traces[0]?.traceId, "aabb");
    assert.equal(traces[0]?.rootSpanName, "GET /orders");
    assert.equal(traces[0]?.status, "ERROR");
    assert.equal(traces[0]?.durationMs, 250);
  });
});

describe("parseLogs", () => {
  it("flattens OTLP log records", () => {
    const logs = parseLogs({
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  timeUnixNano: "1000000000",
                  severityText: "ERROR",
                  body: { stringValue: "payment failed" },
                  traceId: "aabb"
                }
              ]
            }
          ]
        }
      ]
    });
    assert.equal(logs[0]?.severity, "ERROR");
    assert.equal(logs[0]?.body, "payment failed");
    assert.equal(logs[0]?.traceId, "aabb");
  });
});
