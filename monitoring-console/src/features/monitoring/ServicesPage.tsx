import { Activity, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "../../shared/ui/ActionButton";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { listServices, listWindows, sendSampleWindow } from "./api";
import { errorRate, formatPercent, latestWindow, throughputPerMinute } from "./model";
import { RegisterServiceForm } from "./RegisterServiceForm";

export function ServicesPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const services = useQuery({ queryFn: listServices, queryKey: ["monitoring", "services"] });
  const windows = useQuery({
    enabled: (services.data?.length ?? 0) > 0,
    queryFn: async () => {
      const rows = await Promise.all((services.data ?? []).map((service) => listWindows(service.ItemId)));
      return Object.fromEntries((services.data ?? []).map((service, index) => [service.ItemId, latestWindow(rows[index] ?? [])]));
    },
    queryKey: ["monitoring", "service-windows", services.data?.map((service) => service.ItemId).join(",")]
  });

  return (
    <section>
      <PageHeader
        title="Services"
        subtitle="Latency, throughput, and error rate for every registered backend."
        actions={<ActionButton variant="icon" onClick={() => { void services.refetch(); void windows.refetch(); }} title="Refresh" icon={<RefreshCw size={18} />} />}
      />
      {services.isLoading ? <Skeleton className="skeleton-line-lg" /> : null}
      {services.isError ? <ErrorState message="Could not load services." onRetry={() => void services.refetch()} /> : null}
      {services.isSuccess && services.data.length === 0 ? (
        <EmptyState
          icon={<Activity size={20} />}
          title="No services yet"
          description="Register a backend with an ingest key, then point its OTel exporter at the ingest worker."
        />
      ) : null}
      <RegisterServiceForm onCreated={() => void services.refetch()} />
      {services.isSuccess && services.data.length > 0 ? (
        <DataTable
          rows={services.data}
          columns={[
            { key: "name", header: "Service", render: (row) => (
              <div>
                <button className="link-button" onClick={() => onNavigate(`/services/${row.ItemId}`)}>{row.name}</button>
                {row.environment !== "local-ingest" ? <div className="muted">{row.ItemId}</div> : null}
              </div>
            ) },
            { key: "environment", header: "Env", render: (row) => row.environment === "local-ingest" ? "local ingest" : row.environment },
            { key: "p95", header: "p95", render: (row) => `${windows.data?.[row.ItemId]?.latencyP95Ms ?? 0} ms` },
            { key: "throughput", header: "Throughput", render: (row) => `${throughputPerMinute(windows.data?.[row.ItemId]).toFixed(0)} rpm` },
            { key: "errors", header: "Errors", render: (row) => {
              const rate = errorRate(windows.data?.[row.ItemId]);
              return <StatusPill tone={rate > (row.sloErrorRate || 0.05) ? "warn" : "good"}>{formatPercent(rate)}</StatusPill>;
            } },
            { key: "sample", header: "", render: (row) => row.environment === "local-ingest"
              ? <span className="muted">In-memory</span>
              : <button className="link-button" onClick={() => void sendSampleWindow(row.ItemId).then(() => windows.refetch())}>Send sample</button> }
          ]}
        />
      ) : null}
    </section>
  );
}
