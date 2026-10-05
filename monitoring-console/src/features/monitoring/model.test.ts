import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chartPoints,
  errorRate,
  filterByTraceId,
  formatBytes,
  latestWindow,
  sampleWindow,
  throughputPerMinute
} from "./model.ts";

const older = {
  serviceId: "svc",
  windowStart: "2026-10-04T10:00:00.000Z",
  windowSeconds: 60,
  requestCount: 10,
  errorCount: 1,
  latencyP50Ms: 20,
  latencyP95Ms: 40,
  latencyP99Ms: 80,
  cpuPercent: 10,
  memoryBytes: 2048
};

const newer = { ...older, windowStart: "2026-10-04T10:01:00.000Z", requestCount: 20, errorCount: 5, latencyP95Ms: 90 };

describe("errorRate", () => {
  it("is 0 when there are no requests", () => {
    assert.equal(errorRate({ requestCount: 0, errorCount: 2 }), 0);
  });

  it("divides errors by requests", () => {
    assert.equal(errorRate(newer), 0.25);
  });
});

describe("latestWindow", () => {
  it("returns the newest window by start time", () => {
    assert.equal(latestWindow([older, newer])?.windowStart, newer.windowStart);
  });
});

describe("chartPoints", () => {
  it("returns values in chronological order", () => {
    assert.deepEqual(chartPoints([newer, older], (window) => window.latencyP95Ms), [40, 90]);
  });
});

describe("throughputPerMinute", () => {
  it("keeps a 60 second window as requests per minute", () => {
    assert.equal(throughputPerMinute(newer), 20);
  });
});

describe("filterByTraceId", () => {
  const rows = [
    { traceId: "aaa", body: "one" },
    { traceId: "bbb", body: "two" }
  ];

  it("returns every row when the filter is blank", () => {
    assert.equal(filterByTraceId(rows, " ").length, 2);
  });

  it("keeps only matching trace ids", () => {
    assert.deepEqual(filterByTraceId(rows, "bbb"), [{ traceId: "bbb", body: "two" }]);
  });
});

describe("formatBytes", () => {
  it("formats kibibytes", () => {
    assert.equal(formatBytes(2048), "2.0 KB");
  });
});

describe("sampleWindow", () => {
  it("builds a one minute window for the service", () => {
    const window = sampleWindow("svc-1", new Date("2026-10-04T10:00:37.000Z"));
    assert.equal(window.serviceId, "svc-1");
    assert.equal(window.windowStart, "2026-10-04T10:00:00.000Z");
    assert.equal(window.requestCount, 10);
    assert.equal(window.errorCount, 1);
  });
});
