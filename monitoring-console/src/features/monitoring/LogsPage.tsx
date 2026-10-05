import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { listLogs } from "./api";
import { filterByTraceId } from "./model";

export function LogsPage({ onNavigate, serviceId, initialTraceId = "" }: { initialTraceId?: string; onNavigate: (path: string) => void; serviceId: string }) {
  const [traceId, setTraceId] = useState(initialTraceId);
  const logs = useQuery({ queryFn: () => listLogs(serviceId), queryKey: ["monitoring", "logs", serviceId] });
  const rows = useMemo(() => filterByTraceId(logs.data ?? [], traceId), [logs.data, traceId]);

  return (
    <section>
      <PageHeader
        title="Logs"
        subtitle="Recent log lines retained for this service."
        actions={<button className="link-button" onClick={() => onNavigate(`/services/${serviceId}`)}>Back to service</button>}
      />
      <label className="form-field">
        <span>Trace id</span>
        <input value={traceId} onChange={(event) => setTraceId(event.target.value)} placeholder="Filter by trace id" />
      </label>
      {logs.isLoading ? <Skeleton className="skeleton-line-lg" /> : null}
      {logs.isError ? <ErrorState message="Could not load logs." onRetry={() => void logs.refetch()} /> : null}
      {logs.isSuccess && rows.length === 0 ? <EmptyState title="No log lines" description="Ingest recent logs to inspect them here." /> : null}
      {rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={[
            { key: "time", header: "Time", render: (row) => row.timestamp },
            { key: "severity", header: "Severity", render: (row) => <StatusPill tone={row.severity === "ERROR" || row.severity === "FATAL" ? "warn" : "good"}>{row.severity}</StatusPill> },
            { key: "body", header: "Message", render: (row) => row.body },
            { key: "traceId", header: "Trace", render: (row) => row.traceId ? (
              <button className="link-button" onClick={() => onNavigate(`/services/${serviceId}/traces?traceId=${row.traceId}`)}>{row.traceId}</button>
            ) : "—" }
          ]}
        />
      ) : null}
    </section>
  );
}
