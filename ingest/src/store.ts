import type { MetricWindow } from "./telemetry.ts";
import type { ParsedLog, ParsedTrace } from "./otlp.ts";

export type StoredService = {
  itemId: string;
  name: string;
  ingestKeyHash: string;
  sloLatencyMs: number;
};

export type StoredTrace = ParsedTrace & { serviceId: string };
export type StoredLog = ParsedLog & { serviceId: string };

export interface BlocksStore {
  listServices(): Promise<StoredService[]>;
  listWindows(serviceId?: string): Promise<MetricWindow[]>;
  getWindow(serviceId: string, windowStartIso: string): Promise<MetricWindow | undefined>;
  upsertWindow(window: MetricWindow): Promise<void>;
  createTrace(trace: StoredTrace): Promise<void>;
  countLogs(serviceId: string): Promise<number>;
  createLog(log: StoredLog): Promise<void>;
}

export function createMemoryStore(seed: StoredService[] = []): BlocksStore {
  const services = [...seed];
  const windows = new Map<string, MetricWindow>();
  const traces: StoredTrace[] = [];
  const logs: StoredLog[] = [];

  return {
    async listServices() {
      return services;
    },
    async listWindows(serviceId) {
      const rows = [...windows.values()];
      return serviceId ? rows.filter((window) => window.serviceId === serviceId) : rows;
    },
    async getWindow(serviceId, windowStartIso) {
      return windows.get(`${serviceId}:${windowStartIso}`);
    },
    async upsertWindow(window) {
      windows.set(`${window.serviceId}:${window.windowStart}`, window);
    },
    async createTrace(trace) {
      traces.push(trace);
    },
    async countLogs(serviceId) {
      return logs.filter((line) => line.serviceId === serviceId).length;
    },
    async createLog(log) {
      logs.push(log);
    }
  };
}
