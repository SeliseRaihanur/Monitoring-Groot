import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateWindow, percentile, shouldKeepLog, shouldSampleTrace, windowStart } from "../src/telemetry.ts";

describe("percentile", () => {
  it("returns 0 for an empty series", () => {
    assert.equal(percentile([], 0.95), 0);
  });

  it("returns the single sample for any percentile", () => {
    assert.equal(percentile([12], 0.99), 12);
  });

  it("computes p50 p95 and p99 from sorted latencies", () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    assert.equal(percentile(samples, 0.5), 50);
    assert.equal(percentile(samples, 0.95), 100);
    assert.equal(percentile(samples, 0.99), 100);
  });
});

describe("windowStart", () => {
  it("floors timestamps to the start of a 60 second window", () => {
    assert.equal(windowStart(new Date("2026-10-04T10:00:37.800Z"), 60).toISOString(), "2026-10-04T10:00:00.000Z");
  });
});

describe("aggregateWindow", () => {
  it("rolls request error latency cpu and memory into one minute window", () => {
    const existing = {
      serviceId: "svc-1",
      windowStart: "2026-10-04T10:00:00.000Z",
      windowSeconds: 60,
      requestCount: 4,
      errorCount: 1,
      latencyP50Ms: 20,
      latencyP95Ms: 40,
      latencyP99Ms: 40,
      cpuPercent: 10,
      memoryBytes: 1000,
      latenciesMs: [10, 20, 30, 40]
    };
    const next = aggregateWindow(existing, {
      requestCount: 2,
      errorCount: 1,
      latenciesMs: [80, 200],
      cpuPercent: 25,
      memoryBytes: 2048
    });
    assert.equal(next.requestCount, 6);
    assert.equal(next.errorCount, 2);
    assert.equal(next.latencyP50Ms, 30);
    assert.equal(next.latencyP95Ms, 200);
    assert.equal(next.cpuPercent, 25);
    assert.equal(next.memoryBytes, 2048);
  });
});

describe("shouldSampleTrace", () => {
  it("keeps error traces", () => {
    assert.equal(shouldSampleTrace({ status: "ERROR", durationMs: 10, sloLatencyMs: 500 }), true);
  });

  it("keeps traces slower than the SLO", () => {
    assert.equal(shouldSampleTrace({ status: "OK", durationMs: 800, sloLatencyMs: 500 }), true);
  });

  it("drops fast successful traces", () => {
    assert.equal(shouldSampleTrace({ status: "OK", durationMs: 40, sloLatencyMs: 500 }), false);
  });
});

describe("shouldKeepLog", () => {
  it("rejects a log when the service already has the retention cap", () => {
    assert.equal(shouldKeepLog(500, 500), false);
  });

  it("keeps a log under the cap", () => {
    assert.equal(shouldKeepLog(12, 500), true);
  });
});
