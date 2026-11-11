"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Building2,
  FilePlus2,
  FileSpreadsheet,
  Globe,
  HelpCircle,
  KeySquare,
  Layers,
  LayoutDashboard,
  Link2,
  LogOut,
  MapPin,
  Package,
  Search,
  Settings,
  ShieldAlert,
  Truck,
  Users,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-client";
import {
  canAccessDashboard,
  canCreateShipment,
  canSeeNavItem,
} from "@/lib/auth/permission";
import { refreshAccessSession } from "@/lib/auth/refresh";
import {
  type AccessSession,
  clearAccessSession,
  getAccessSession,
  type SessionUser,
  subscribeAccessSession,
} from "@/lib/auth/session";
import { formatSscc } from "@/lib/gs1/sscc";
import type {
  NotificationBreachConfirmed,
  NotificationRecall,
} from "@/lib/realtime/events";
import type { ReadingSubscriber } from "@/lib/realtime/subscriptions";
import { RealtimeClient, type RealtimeStatus } from "@/lib/realtime/websocket";
import { cn } from "@/lib/utils";

interface SessionContextValue {
  session: AccessSession | null;
  user: SessionUser | null;
  isHydrating: boolean;
  realtimeStatus: RealtimeStatus;
  subscribeTelemetry: (sscc: string, callback: ReadingSubscriber) => () => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside AppShellProvider");
  }
  return ctx;
}

const PUBLIC_PATHS = new Set(["/login", "/register"]);

function SidebarNavigation({
  user,
  openBreachCount,
}: {
  user: SessionUser;
  openBreachCount: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStep = searchParams.get("step");

  const latestShipmentQuery = useQuery({
    queryKey: queryKeys.shipments.list({ limit: 1 }),
    queryFn: async () =>
      unwrap(
        await apiClient.GET("/api/v1/shipments", {
          params: { query: { limit: 1 } },
        }),
      ),
    enabled: Boolean(user && canAccessDashboard(user)),
    staleTime: 30_000,
  });

  // Extract shipmentId if currently on /shipments/[id]
  const currentShipmentId = useMemo(() => {
    const match = pathname.match(/^\/shipments\/([^/]+)$/);
    if (match && match[1] !== "new") {
      return match[1];
    }
    return latestShipmentQuery.data?.items?.[0]?.id ?? null;
  }, [pathname, latestShipmentQuery.data?.items]);

  const isOnShipmentDetail = Boolean(
    pathname.match(/^\/shipments\/([^/]+)$/) && pathname !== "/shipments/new",
  );

  const stepHref = (step: "2" | "3" | "4") =>
    currentShipmentId
      ? `/shipments/${currentShipmentId}?step=${step}`
      : "/shipments";

  const createShipmentAllowed = canCreateShipment(user).allowed;

  return (
    <nav
      aria-label="Primary Sidebar Navigation"
      className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
    >
      {/* OPERATIONAL OVERVIEW */}
      {canSeeNavItem(user, "overview") && (
        <div className="space-y-1">
          <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            OPERATIONAL OVERVIEW
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname === "/"
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <LayoutDashboard className="size-4 shrink-0" />
                <span>Control Tower</span>
              </Link>
            </li>
          </ul>
        </div>
      )}

      {/* SHIPMENTS & DISPATCH */}
      {canSeeNavItem(user, "shipments") && (
        <div className="space-y-1">
          <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            SHIPMENTS &amp; DISPATCH
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/shipments"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname === "/shipments"
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <FileSpreadsheet className="size-4 shrink-0" />
                <span>Quản lý vận đơn</span>
              </Link>
            </li>
            {createShipmentAllowed && (
              <li>
                <Link
                  href="/shipments/new"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                    pathname === "/shipments/new"
                      ? "bg-[#0F172A] font-bold text-white shadow-xs"
                      : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <FilePlus2 className="size-4 shrink-0" />
                  <span>Tạo vận đơn</span>
                </Link>
              </li>
            )}
            <li>
              <Link
                href={stepHref("2")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  isOnShipmentDetail && currentStep === "2"
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Truck className="size-4 shrink-0" />
                <span>Điều phối &amp; Gán tài xế</span>
              </Link>
            </li>
            <li>
              <Link
                href={stepHref("3")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  isOnShipmentDetail && currentStep === "3"
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <KeySquare className="size-4 shrink-0" />
                <span>Cấp mã Pickup Dock</span>
              </Link>
            </li>
            <li>
              <Link
                href={stepHref("4")}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  isOnShipmentDetail &&
                    (currentStep === "4" || !currentStep)
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Link2 className="size-4 shrink-0" />
                <span>Hành trình &amp; Hash Chain</span>
              </Link>
            </li>
          </ul>
        </div>
      )}

      {/* WAREHOUSE & LOTS */}
      <div className="space-y-1">
        <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          WAREHOUSE &amp; LOTS
        </div>
        <ul className="space-y-0.5">
          {canSeeNavItem(user, "lots") && (
            <li>
              <Link
                href="/lots"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname.startsWith("/lots")
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Layers className="size-4 shrink-0" />
                <span>Khởi tạo Lô - Commission</span>
              </Link>
            </li>
          )}
          {canSeeNavItem(user, "inventory") && (
            <li>
              <Link
                href="/inventory"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname.startsWith("/inventory")
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Boxes className="size-4 shrink-0" />
                <span>Bảng tồn kho Balances</span>
              </Link>
            </li>
          )}
          {canSeeNavItem(user, "alerts") && (
            <li>
              <Link
                href="/alerts"
                className={cn(
                  "flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname.startsWith("/alerts")
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Thu hồi khẩn cấp Recall</span>
                </span>
                {openBreachCount > 0 && (
                  <span className="rounded-full bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-rose-700">
                    {openBreachCount}
                  </span>
                )}
              </Link>
            </li>
          )}
        </ul>
      </div>

      {/* MASTER DATA & CATALOG */}
      {(canSeeNavItem(user, "locations") ||
        canSeeNavItem(user, "products")) && (
        <div className="space-y-1">
          <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            MASTER DATA &amp; CATALOG
          </div>
          <ul className="space-y-0.5">
            {canSeeNavItem(user, "locations") && (
              <li>
                <Link
                  href="/catalog/locations"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                    pathname.startsWith("/catalog/locations")
                      ? "bg-[#0F172A] font-bold text-white shadow-xs"
                      : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <MapPin className="size-4 shrink-0" />
                  <span>Địa điểm &amp; Geo-fence</span>
                </Link>
              </li>
            )}
            {canSeeNavItem(user, "products") && (
              <li>
                <Link
                  href="/catalog/products"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                    pathname.startsWith("/catalog/products")
                      ? "bg-[#0F172A] font-bold text-white shadow-xs"
                      : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Package className="size-4 shrink-0" />
                  <span>Sản phẩm &amp; Nhiệt độ</span>
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* PLATFORM */}
      <div className="space-y-1">
        <div className="px-2.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          PLATFORM
        </div>
        <ul className="space-y-0.5">
          {canSeeNavItem(user, "users") && (
            <li>
              <Link
                href="/users"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname.startsWith("/users")
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Users className="size-4 shrink-0" />
                <span>Quản lý Người dùng</span>
              </Link>
            </li>
          )}
          {canSeeNavItem(user, "settings") && (
            <li>
              <Link
                href="/settings/profile"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors",
                  pathname.startsWith("/settings")
                    ? "bg-[#0F172A] font-bold text-white shadow-xs"
                    : "font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                <Settings className="size-4 shrink-0" />
                <span>System Settings</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tAuth = useTranslations("auth");
  const tRole = useTranslations("role");
  const tRealtime = useTranslations("realtime");

  const session = useSyncExternalStore(
    subscribeAccessSession,
    getAccessSession,
    () => null,
  );
  const user = session?.user ?? null;

  const [isHydrating, setIsHydrating] = useState(true);
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("disconnected");
  const [breachToasts, setBreachToasts] = useState<
    NotificationBreachConfirmed[]
  >([]);
  const [pendingRecalls, setPendingRecalls] = useState<NotificationRecall[]>(
    [],
  );
  const [globalSearch, setGlobalSearch] = useState("");
  const acknowledgedRecallsRef = useRef<Set<string>>(new Set());
  const realtimeRef = useRef<RealtimeClient | null>(null);

  const isPublicRoute = PUBLIC_PATHS.has(pathname);

  useEffect(() => {
    let active = true;
    async function restore() {
      if (!getAccessSession()) {
        await refreshAccessSession();
      }
      if (active) {
        setIsHydrating(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isHydrating) {
      return;
    }
    if (!session && !isPublicRoute) {
      router.replace("/login");
      return;
    }
    if (session && isPublicRoute && canAccessDashboard(session.user)) {
      router.replace("/");
    }
  }, [isHydrating, isPublicRoute, router, session]);

  useEffect(() => {
    if (!session || !canAccessDashboard(session.user)) {
      realtimeRef.current?.disconnect();
      realtimeRef.current = null;
      setRealtimeStatus("disconnected");
      return;
    }

    const client = new RealtimeClient(queryClient, {
      onStatusChange: setRealtimeStatus,
      onBreachConfirmed: (breach) => {
        setBreachToasts((prev) => [breach, ...prev].slice(0, 3));
      },
      onShipmentRecalled: (recall) => {
        const key = `${recall.recall_id}:${recall.shipment_id}`;
        if (acknowledgedRecallsRef.current.has(key)) {
          return;
        }
        setPendingRecalls((prev) =>
          prev.some((item) => item.shipment_id === recall.shipment_id)
            ? prev
            : [...prev, recall],
        );
      },
    });
    realtimeRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
      if (realtimeRef.current === client) {
        realtimeRef.current = null;
      }
    };
  }, [queryClient, session]);

  const subscribeTelemetry = useCallback(
    (sscc: string, callback: ReadingSubscriber) => {
      if (!realtimeRef.current) {
        return () => undefined;
      }
      return realtimeRef.current.subscribeTelemetry(sscc, callback);
    },
    [],
  );

  const logout = useCallback(async () => {
    realtimeRef.current?.disconnect();
    await fetch("/bff/session/logout", {
      method: "POST",
      credentials: "same-origin",
    }).catch(() => null);
    clearAccessSession();
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);

  const incidentSummaryQuery = useQuery({
    queryKey: queryKeys.telemetry.incidentsSummary(),
    queryFn: async () =>
      unwrap(await apiClient.GET("/api/v1/telemetry/incidents/summary")),
    enabled: Boolean(user && canAccessDashboard(user) && !isPublicRoute),
    retry: false,
  });

  const openBreachCount = incidentSummaryQuery.data?.open_count ?? 0;

  const contextValue = useMemo<SessionContextValue>(
    () => ({
      session,
      user,
      isHydrating,
      realtimeStatus,
      subscribeTelemetry,
      logout,
    }),
    [isHydrating, logout, realtimeStatus, session, subscribeTelemetry, user],
  );

  const activeRecall = pendingRecalls[0] ?? null;

  function acknowledgeRecall(recall: NotificationRecall) {
    acknowledgedRecallsRef.current.add(
      `${recall.recall_id}:${recall.shipment_id}`,
    );
    setPendingRecalls((prev) =>
      prev.filter((item) => item.shipment_id !== recall.shipment_id),
    );
  }

  function switchLocale(nextLocale: "vi" | "en") {
    router.replace(pathname, { locale: nextLocale });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = globalSearch.trim();
    if (!q) {
      router.push("/shipments");
      return;
    }
    router.push(`/shipments?q=${encodeURIComponent(q)}`);
  }

  if (isPublicRoute) {
    return (
      <SessionContext.Provider value={contextValue}>
        {children}
      </SessionContext.Provider>
    );
  }

  if (isHydrating || !user) {
    return (
      <SessionContext.Provider value={contextValue}>
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-sm font-medium text-slate-600">
          {tAuth("sessionRestoring")}
        </div>
      </SessionContext.Provider>
    );
  }

  if (!canAccessDashboard(user)) {
    return (
      <SessionContext.Provider value={contextValue}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] p-6 text-center text-slate-900">
          <ShieldAlert className="size-10 text-amber-600" />
          <p className="max-w-md text-sm font-medium text-slate-800">
            {tAuth("driverRoleBlocked")}
          </p>
          <Button variant="outline" onClick={() => void logout()}>
            <LogOut className="size-4" />
            {tNav("logout")}
          </Button>
        </div>
      </SessionContext.Provider>
    );
  }

  return (
    <SessionContext.Provider value={contextValue}>
      <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900">
        {/* Left GS1 Control Tower Sidebar */}
        <aside
          aria-label="GS1 Control Tower Sidebar"
          className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/90 bg-white lg:flex"
        >
          {/* Brand Header */}
          <div className="flex h-14 items-center gap-2.5 border-b border-slate-200/80 px-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[#0F172A] text-[#38BDF8] shadow-xs">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-4.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                  />
                </svg>
              </span>
              <div className="leading-tight">
                <div className="text-xs font-extrabold tracking-tight text-slate-900">
                  GS1 Control Tower
                </div>
                <div className="font-mono text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                  TRACEABILITY ENGINE
                </div>
              </div>
            </Link>
          </div>

          <Suspense fallback={<div className="flex-1 px-3 py-4" />}>
            <SidebarNavigation user={user} openBreachCount={openBreachCount} />
          </Suspense>

          {/* Sidebar Node Footer */}
          <div className="border-t border-slate-200/80 p-3.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono font-bold text-slate-700">
                Node GCP-{user.tenant.gs1_company_prefix.slice(0, 3)}
              </span>
              <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                v2.4.12-rc
              </span>
            </div>
            <div className="mt-0.5 text-[10px] font-medium text-slate-400">
              {user.tenant.code} Cold Chain Cluster
            </div>
          </div>
        </aside>

        {/* Right Main Content Column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Control Tower Header Bar */}
          <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              {/* Left Tenant Badge & Search */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-blue-200/80 bg-blue-50/60 px-3 py-1.5 text-xs font-bold text-slate-900">
                  <Building2 className="size-3.5 text-[#2563EB]" />
                  <span>
                    {user.tenant.code} - {user.tenant.legal_name} (GCP{" "}
                    {user.tenant.gs1_company_prefix})
                  </span>
                </div>

                {/* Global Search Bar */}
                <form
                  onSubmit={handleSearchSubmit}
                  className="relative hidden w-72 xl:block"
                >
                  <Search className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-slate-400" />
                  <input
                    type="search"
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    placeholder="Tìm SSCC, GTIN, EPCIS"
                    className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/70 pr-3 pl-8.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                  />
                </form>
              </div>

              {/* Right Status & Profile Controls */}
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold sm:flex",
                    realtimeStatus === "connected"
                      ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                      : "border-slate-200 bg-slate-50 text-slate-600",
                  )}
                  title={tRealtime(realtimeStatus)}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      realtimeStatus === "connected"
                        ? "bg-[#2563EB]"
                        : "bg-amber-500",
                    )}
                  />
                  <span>EPCIS 2.0 Synced</span>
                </div>

                <Link
                  href="/alerts"
                  className="relative inline-flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
                  aria-label={tRealtime("openBreaches", {
                    count: openBreachCount,
                  })}
                  title={tRealtime("openBreaches", { count: openBreachCount })}
                >
                  <Bell className="size-4" />
                  {openBreachCount > 0 && (
                    <span className="absolute top-1 right-1 size-2 rounded-full bg-rose-600" />
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => switchLocale(locale === "vi" ? "en" : "vi")}
                  className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
                  title={`${tNav("language")}: ${locale === "vi" ? "English" : "Tiếng Việt"}`}
                >
                  <HelpCircle className="size-4" />
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1 text-right transition hover:bg-slate-100"
                    >
                      <div className="hidden leading-tight sm:block">
                        <div className="max-w-40 truncate text-xs font-bold text-slate-900">
                          {user.full_name}
                        </div>
                        <div className="text-[10px] font-medium text-slate-500">
                          {tRole(user.role)}
                        </div>
                      </div>
                      <span className="flex size-8 items-center justify-center rounded-full bg-[#0F172A] text-xs font-bold text-white">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="space-y-0.5">
                      <div className="truncate text-sm font-bold">
                        {user.full_name}
                      </div>
                      <div className="truncate text-xs font-normal text-muted-foreground">
                        {user.email}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings/profile">{tNav("profile")}</Link>
                    </DropdownMenuItem>
                    {user.role === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link href="/settings/tenant">{tNav("tenant")}</Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        switchLocale(locale === "vi" ? "en" : "vi")
                      }
                    >
                      <Globe className="size-4" />
                      {tNav("language")}:{" "}
                      {locale === "vi" ? "English" : "Tiếng Việt"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => void logout()}
                    >
                      <LogOut className="size-4" />
                      {tNav("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* Main Workspace Container */}
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
            {children}
          </main>
        </div>

        {breachToasts.length > 0 && (
          <div className="fixed right-4 bottom-4 z-40 flex w-full max-w-sm flex-col gap-2">
            {breachToasts.map((toast) => (
              <div
                key={toast.incident_id}
                role="status"
                className="flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3.5 text-xs text-red-950 shadow-lg"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {tRealtime("breachToastTitle")}
                  </p>
                  <p>
                    {tRealtime("breachToastBody", {
                      product: toast.product_name,
                      sscc: formatSscc(toast.sscc),
                      temp: toast.temperature_celsius.toFixed(1),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBreachToasts((prev) =>
                      prev.filter(
                        (item) => item.incident_id !== toast.incident_id,
                      ),
                    )
                  }
                  className="text-red-700 hover:text-red-950"
                  aria-label={tApp("close")}
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {activeRecall && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="recall-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          >
            <div className="w-full max-w-lg rounded-xl border-2 border-red-600 bg-red-950 p-6 text-white shadow-2xl">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-6 shrink-0 text-red-300" />
                <div className="flex-1 space-y-3">
                  <h2
                    id="recall-modal-title"
                    className="text-lg font-bold tracking-tight"
                  >
                    {tRealtime("recallModalTitle")}
                  </h2>
                  <p className="text-sm text-red-100">
                    {tRealtime("recallModalDescription")}
                  </p>
                  <dl className="grid grid-cols-2 gap-2 rounded-lg bg-red-900/60 p-3 text-xs">
                    <div>
                      <dt className="text-red-300">SSCC</dt>
                      <dd className="font-mono font-semibold">
                        {formatSscc(activeRecall.sscc)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-red-300">Lot</dt>
                      <dd className="font-mono font-semibold">
                        {activeRecall.lot_number}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-red-300">
                        {tRealtime("recallReason")}
                      </dt>
                      <dd className="font-medium">{activeRecall.reason}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const shipmentId = activeRecall.shipment_id;
                        acknowledgeRecall(activeRecall);
                        router.push(`/shipments/${shipmentId}`);
                      }}
                    >
                      {tRealtime("viewShipment")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => acknowledgeRecall(activeRecall)}
                    >
                      {tRealtime("acknowledgeRecall")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SessionContext.Provider>
  );
}
