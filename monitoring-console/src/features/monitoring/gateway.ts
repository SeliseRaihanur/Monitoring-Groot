export type Page<T> = { items: T[]; totalCount: number };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function pageFrom<T>(value: unknown): Page<T> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const items = record.items ?? record.Items ?? record.data;
  if (!Array.isArray(items)) return undefined;
  return { items: items as T[], totalCount: Number(record.totalCount ?? record.TotalCount ?? items.length) };
}

/** collection.list() returns the raw GraphQL body: `{ data: { getServices: { items } } }`. */
export function unwrapPage<T>(result: unknown): Page<T> {
  const direct = pageFrom<T>(result);
  if (direct) return direct;

  const root = asRecord(result);
  const data = asRecord(root?.data) ?? root;
  const fromData = pageFrom<T>(data);
  if (fromData) return fromData;

  for (const value of Object.values(data ?? {})) {
    const nested = pageFrom<T>(value);
    if (nested) return nested;
    const fromNested = pageFrom<T>(asRecord(value)?.data);
    if (fromNested) return fromNested;
  }

  return { items: [], totalCount: 0 };
}

export function field(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function withItemId<T extends Record<string, unknown>>(row: T): T & { ItemId: string; itemId: string } {
  const id = String(field(row, "ItemId", "itemId", "id") ?? "");
  return { ...row, ItemId: id, itemId: id };
}
