import { createServer } from "node:http";
import { handleIngest } from "./handle.ts";
import { createMemoryStore, type BlocksStore } from "./store.ts";
import { hashIngestKey } from "./auth.ts";
import { createBlocksStore } from "./blocks-store.ts";

const port = Number(process.env.INGEST_PORT || 4318);
const store: BlocksStore = process.env.BLOCKS_INGEST_ACCESS_TOKEN
  ? createBlocksStore()
  : createMemoryStore(
      process.env.INGEST_DEMO_KEY
        ? [
            {
              itemId: process.env.INGEST_DEMO_SERVICE_ID || "demo-service",
              name: process.env.INGEST_DEMO_SERVICE_NAME || "demo",
              ingestKeyHash: hashIngestKey(process.env.INGEST_DEMO_KEY),
              sloLatencyMs: Number(process.env.INGEST_DEMO_SLO_MS || 500)
            }
          ]
        : []
    );

function decodeJsonBody(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return Buffer.from(buffer.subarray(2)).swap16().toString("utf16le");
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.subarray(3).toString("utf8");
  }
  if (buffer.length >= 2 && buffer[1] === 0x00 && buffer[0] !== 0x00) {
    return buffer.toString("utf16le");
  }
  return buffer.toString("utf8");
}

function readBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(decodeJsonBody(Buffer.concat(chunks))));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/v1/snapshot") {
      const services = await store.listServices();
      const windows = await store.listWindows();
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({
        source: process.env.BLOCKS_INGEST_ACCESS_TOKEN ? "blocks" : "memory",
        services: services.map((service) => ({ itemId: service.itemId, name: service.name })),
        windows
      }));
      return;
    }
    const body = req.method === "POST" ? await readBody(req) : {};
    const result = await handleIngest(store, {
      path: url.pathname,
      authorization: typeof req.headers.authorization === "string" ? req.headers.authorization : undefined,
      body
    });
    res.writeHead(result.status, { "content-type": "application/json" });
    res.end(JSON.stringify(result.body));
  } catch (error) {
    const invalidJson = error instanceof SyntaxError;
    res.writeHead(invalidJson ? 400 : 502, { "content-type": "application/json" });
    res.end(JSON.stringify({
      code: invalidJson ? "bad_request" : "blocks_write_failed",
      message: invalidJson ? "Invalid JSON body" : "Ingest could not write to Blocks"
    }));
  }
});

server.listen(port, () => {
  process.stdout.write(`ingest listening on ${port}\n`);
});
