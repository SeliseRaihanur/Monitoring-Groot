import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { JsonPanel } from "../../shared/ui/JsonPanel";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { listTraces } from "./api";
import { filterByTraceId } from "./model";

export function TracesPage({ onNavigate, serviceId }: { onNavigate: (path: string) => void; serviceId: string }) {
  const [traceId, setTraceId] = useState("");
  const [openId, setOpenId] = useState("");
  const traces = useQuery({ queryFn: () => listTraces(serviceId), queryKey: ["monitoring", "traces", serviceId] });
  const rows = useMemo(() => filterByTraceId(traces.data ?? [], traceId), [traceId, traces.data]);
  const selected = rows.find((row) => row.ItemId === openId);

  return (
    <section>
      <PageHeader
        title="Sampled traces"
        subtitle="Errors and slow traces kept by the ingest worker."
        actions={<button className="link-button" onClick={() => onNavigate(`/services/${serviceId}`)}>Back to service</button>}
      />
      <label className="form-field">
        <span>Trace id</span>
        <input value={traceId} onChange={(event) => setTraceId(event.target.value)} placeholder="Filter by trace id" />
      </label>
      {traces.isLoading ? <Skeleton className="skeleton-line-lg" /> : null}
      {traces.isError ? <ErrorState message="Could not load traces." onRetry={() => void traces.refetch()} /> : null}
      {traces.isSuccess && rows.length === 0 ? <EmptyState title="No sampled traces" description="Error and slow traces appear here after ingest." /> : null}
      {rows.length > 0 ? (
        <DataTable
          rows={rows}
          columns={[
            { key: "traceId", header: "Trace", render: (row) => (
              <button className="link-button" onClick={() => { setOpenId(row.ItemId); onNavigate(`/services/${serviceId}/logs?traceId=${row.traceId}`); }}>{row.traceId}</button>
            ) },
            { key: "name", header: "Span", render: (row) => row.rootSpanName },
            { key: "duration", header: "Duration", render: (row) => `${row.durationMs} ms` },
            { key: "status", header: "Status", render: (row) => <StatusPill tone={row.status === "ERROR" ? "warn" : "good"}>{row.status}</StatusPill> },
            { key: "open", header: "", render: (row) => <button className="link-button" onClick={() => setOpenId(row.ItemId)}>Spans</button> }
          ]}
        />
      ) : null}
      {selected ? <JsonPanel value={safeJson(selected.spanJson)} /> : null}
    </section>
  );
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { spanJson: value };
  }
}
