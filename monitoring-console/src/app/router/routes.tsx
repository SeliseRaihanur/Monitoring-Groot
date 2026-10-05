import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { LogsPage } from "../../features/monitoring/LogsPage";
import { ServiceDetailPage } from "../../features/monitoring/ServiceDetailPage";
import { ServicesPage } from "../../features/monitoring/ServicesPage";
import { TracesPage } from "../../features/monitoring/TracesPage";
import { ProfilePage } from "../../features/profile/ProfilePage";

function parseServicePath(path: string): { serviceId: string; view: "detail" | "traces" | "logs" } | undefined {
  const match = /^\/services\/([^/]+)(?:\/(traces|logs))?$/.exec(path);
  if (!match?.[1]) return undefined;
  if (match[2] === "traces") return { serviceId: match[1], view: "traces" };
  if (match[2] === "logs") return { serviceId: match[1], view: "logs" };
  return { serviceId: match[1], view: "detail" };
}

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const returnTo = new URLSearchParams(search).get("returnTo") || undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage returnTo={returnTo} />
      </RedirectIfAuthenticated>
    );
  }

  const serviceRoute = parseServicePath(path);
  const traceFilter = new URLSearchParams(search).get("traceId") || "";

  let Page: ((props: { onNavigate: (path: string) => void }) => ReactElement) | null = null;
  if (path === "/") Page = ({ onNavigate }) => <ServicesPage onNavigate={onNavigate} />;
  else if (path === "/profile") Page = () => <ProfilePage />;
  else if (path === "/error") Page = () => <ErrorPage />;
  else if (serviceRoute?.view === "detail") Page = ({ onNavigate }) => <ServiceDetailPage onNavigate={onNavigate} serviceId={serviceRoute.serviceId} />;
  else if (serviceRoute?.view === "traces") Page = ({ onNavigate }) => <TracesPage onNavigate={onNavigate} serviceId={serviceRoute.serviceId} />;
  else if (serviceRoute?.view === "logs") Page = ({ onNavigate }) => <LogsPage onNavigate={onNavigate} serviceId={serviceRoute.serviceId} initialTraceId={traceFilter} />;

  if (!Page) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <AppShell activePath={path === "/" || path.startsWith("/services/") ? "/" : path} onNavigate={navigate}>
        <Page onNavigate={navigate} />
      </AppShell>
    </RequireAuth>
  );
}
