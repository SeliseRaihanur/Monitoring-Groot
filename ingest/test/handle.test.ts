import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashIngestKey } from "../src/auth.ts";
import { handleIngest } from "../src/handle.ts";
import { createMemoryStore } from "../src/store.ts";

const service = {
  itemId: "svc-1",
  name: "orders-api",
  ingestKeyHash: hashIngestKey("secret-key"),
  sloLatencyMs: 200
};

describe("handleIngest", () => {
  it("rejects callers without a matching ingest key", async () => {
    const result = await handleIngest(createMemoryStore([service]), {
      path: "/v1/metrics",
      authorization: "Bearer wrong",
      body: { requestCount: 1 }
    });
    assert.equal(result.status, 401);
    assert.equal(result.body.code, "unauthorized");
  });

  it("rolls fixture metrics into a one minute window", async () => {
    const store = createMemoryStore([service]);
    const result = await handleIngest(store, {
      path: "/v1/metrics",
      authorization: "Bearer secret-key",
      body: { requestCount: 2, errorCount: 1, latenciesMs: [20, 80], cpuPercent: 15, memoryBytes: 1024 }
    });
    assert.equal(result.status, 202);
    const windows = await store.listServices();
    assert.equal(windows[0]?.itemId, "svc-1");
    const start = (await import("../src/telemetry.ts")).windowStart(new Date()).toISOString();
    const saved = await store.getWindow("svc-1", start);
    assert.equal(saved?.requestCount, 2);
    assert.equal(saved?.errorCount, 1);
    assert.equal(saved?.cpuPercent, 15);
  });

  it("maps a Blocks store failure to 502 instead of 400", async () => {
    const store = {
      async listServices() {
        throw new Error("api_auth_failed");
      },
      async listWindows() {
        return [];
      },
      async getWindow() {
        return undefined;
      },
      async upsertWindow() {},
      async createTrace() {},
      async countLogs() {
        return 0;
      },
      async createLog() {}
    };
    const result = await handleIngest(store, {
      path: "/v1/metrics",
      authorization: "Bearer secret-key",
      body: { requestCount: 1 }
    });
    assert.equal(result.status, 502);
    assert.equal(result.body.code, "blocks_write_failed");
  });

  it("drops fast successful traces and keeps errors", async () => {
    const store = createMemoryStore([service]);
    const result = await handleIngest(store, {
      path: "/v1/traces",
      authorization: "Bearer secret-key",
      body: {
        resourceSpans: [
          {
            scopeSpans: [
              {
                spans: [
                  { traceId: "ok", name: "fast", startTimeUnixNano: "0", endTimeUnixNano: "1000000", status: { code: 0 } },
                  { traceId: "bad", name: "boom", startTimeUnixNano: "0", endTimeUnixNano: "2000000", status: { code: 2 } }
                ]
              }
            ]
          }
        ]
      }
    });
    assert.equal(result.status, 202);
    assert.equal(result.body.kept, 1);
  });
});
