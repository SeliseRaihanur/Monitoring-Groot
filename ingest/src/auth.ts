import { createHash } from "node:crypto";

export function hashIngestKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function bearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  const match = /^Bearer\s+(\S+)$/i.exec(trimmed);
  return match?.[1] ?? (trimmed.includes(" ") ? undefined : trimmed);
}

export function matchServiceByBearer<T extends { ingestKeyHash: string }>(
  services: T[],
  authorization: string | undefined
): T | undefined {
  const token = bearerToken(authorization);
  if (!token) return undefined;
  const digest = hashIngestKey(token);
  return services.find((service) => service.ingestKeyHash === digest);
}
