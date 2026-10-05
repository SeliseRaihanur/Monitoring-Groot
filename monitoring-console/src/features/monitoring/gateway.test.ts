import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unwrapPage, withItemId } from "./gateway.ts";

describe("unwrapPage", () => {
  it("reads items from the GraphQL getServices envelope", () => {
    const page = unwrapPage<{ name: string }>({
      data: { getServices: { items: [{ name: "payments" }], totalCount: 1 } }
    });
    assert.equal(page.totalCount, 1);
    assert.equal(page.items[0]?.name, "payments");
  });

  it("reads a flat items page", () => {
    const page = unwrapPage<{ name: string }>({ items: [{ name: "api" }], totalCount: 2 });
    assert.equal(page.items[0]?.name, "api");
    assert.equal(page.totalCount, 2);
  });

  it("returns an empty page when the envelope has no items", () => {
    assert.deepEqual(unwrapPage({ data: { getServices: { totalCount: 0 } } }), { items: [], totalCount: 0 });
  });
});

describe("withItemId", () => {
  it("copies ItemId onto itemId", () => {
    const row = withItemId({ ItemId: "svc-1", name: "api" });
    assert.equal(row.ItemId, "svc-1");
    assert.equal(row.itemId, "svc-1");
  });
});
