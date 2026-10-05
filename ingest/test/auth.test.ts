import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashIngestKey, matchServiceByBearer } from "../src/auth.ts";

describe("hashIngestKey", () => {
  it("returns a stable sha256 hex digest", () => {
    const hash = hashIngestKey("ingest_test_key");
    assert.equal(hash.length, 64);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hashIngestKey("ingest_test_key"), hash);
  });
});

describe("matchServiceByBearer", () => {
  const services = [
    { itemId: "svc-1", ingestKeyHash: hashIngestKey("alpha") },
    { itemId: "svc-2", ingestKeyHash: hashIngestKey("beta") }
  ];

  it("resolves the service whose hash matches the bearer token", () => {
    const found = matchServiceByBearer(services, "Bearer beta");
    assert.equal(found?.itemId, "svc-2");
  });

  it("returns undefined for a missing or unknown key", () => {
    assert.equal(matchServiceByBearer(services, undefined), undefined);
    assert.equal(matchServiceByBearer(services, "Bearer nope"), undefined);
  });

  it("accepts a raw key without the Bearer prefix", () => {
    assert.equal(matchServiceByBearer(services, "beta")?.itemId, "svc-2");
  });
});
