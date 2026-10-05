import { RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ActionButton } from "../../shared/ui/ActionButton";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { listServices, listWindows } from "./api";
import { chartPoints, errorRate, formatBytes, formatPercent, latestWindow, throughputPerMinute } from "./model";
import { Sparkline } from "./Sparkline";

export function ServiceDetailPage({ onNavigate, serviceId }: { onNavigate: (path: string) => void; serviceId: string }) {
  const services = useQuery({ queryFn: listServices, queryKey: ["monitoring", "services"] });
  const windows = useQuery({ queryFn: () => listWindows(serviceId), queryKey: ["monitoring", "windows", serviceId] });
  const service = services.data?.find((row) => row.ItemId === serviceId);
  const latest = latestWindow(windows.data ?? []);

  return (
    <section>
      <PageHeader
        title={service?.name || "Service"}
        subtitle={`${service?.environment || "unknown"} · owner ${service?.owner || "unassigned"}`}
        actions={
          <div className="toolbar-actions">
            <ActionButton onClick={() => onNavigate(`/services/${serviceId}/traces`)}>Traces</ActionButton>
            <ActionButton onClick={() => onNavigate(`/services/${serviceId}/logs`)}>Logs</ActionButton>
            <ActionButton variant="icon" onClick={() => void windows.refetch()} title="Refresh" icon={<RefreshCw size={18} />} />
          </div>
        }
      />
      {windows.isLoading ? <Skeleton className="skeleton-line-lg" /> : null}
      {windows.isError ? <ErrorState message="Could not load metric windows." onRetry={() => void windows.refetch()} /> : null}
      {windows.isSuccess && !latest ? <EmptyState title="No metric windows" description="Send OTLP or fixture metrics to the ingest worker." /> : null}
      {latest ? (
        <>
          <div className="sparkline-grid">
            <Sparkline label="Latency p95" suffix=" ms" values={chartPoints(windows.data ?? [], (row) => row.latencyP95Ms)} />
            <Sparkline label="Throughput" suffix=" rpm" values={chartPoints(windows.data ?? [], throughputPerMinute)} />
            <Sparkline label="Error rate" suffix="%" values={chartPoints(windows.data ?? [], (row) => errorRate(row) * 100)} />
            <Sparkline label="CPU" suffix="%" values={chartPoints(windows.data ?? [], (row) => row.cpuPercent)} />
            <Sparkline label="Memory" suffix="" values={chartPoints(windows.data ?? [], (row) => row.memoryBytes)} />
          </div>
          <p className="muted">
            Latest window {latest.windowStart}: {latest.requestCount} requests, {formatPercent(errorRate(latest))} errors, {formatBytes(latest.memoryBytes)} memory.
          </p>
        </>
      ) : null}
    </section>
  );
}
