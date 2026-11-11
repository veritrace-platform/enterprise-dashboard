"use client";

import {
  ArrowRight,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useSession } from "@/components/app-shell";
import { ProblemBanner } from "@/components/problem-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { canCreateShipment } from "@/lib/auth/permission";
import { formatSscc } from "@/lib/gs1/sscc";
import { cn } from "@/lib/utils";
import { formatQuantity } from "@/utils/format";
import {
  useShipmentSummaryQuery,
  useShipmentsQuery,
} from "../queries/queries";
import type { ParticipantRole, Shipment, ShipmentStatus } from "../types";

type UiStatusTab =
  | "ALL"
  | "UNASSIGNED"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "RECALLED";

const PARTY_OPTIONS: readonly ParticipantRole[] = [
  "OWNER",
  "CARRIER",
  "CONSIGNEE",
  "INSPECTOR",
];

function formatShipmentShortCode(shipment: Pick<Shipment, "sscc" | "created_at">) {
  const year = new Date(shipment.created_at).getUTCFullYear() || 2026;
  return `SHP-${year}-${shipment.sscc.slice(-4)}`;
}

export function ShipmentListView() {
  const { user } = useSession();
  const locale = useLocale();
  const t = useTranslations("shipments");
  const tStatus = useTranslations("status");
  const tParty = useTranslations("party");

  const [uiStatusTab, setUiStatusTab] = useState<UiStatusTab>("ALL");
  const [partyFilter, setPartyFilter] = useState<string>("ALL");
  const [originFilter, setOriginFilter] = useState<string>("ALL");
  const [destinationFilter, setDestinationFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [pageSize, setPageSize] = useState<number>(20);

  // Map UI tab to backend ShipmentStatus filter
  const backendStatusFilter: ShipmentStatus | undefined = useMemo(() => {
    switch (uiStatusTab) {
      case "UNASSIGNED":
      case "ASSIGNED":
        return "CREATED";
      case "IN_TRANSIT":
      case "DELIVERED":
      case "CANCELLED":
      case "RECALLED":
        return uiStatusTab;
      default:
        return undefined;
    }
  }, [uiStatusTab]);

  const digitsOnly = searchInput.replace(/\D/g, "");
  const exactSsccFilter = digitsOnly.length === 18 ? digitsOnly : undefined;

  const queryFilters = {
    status: backendStatusFilter,
    party: partyFilter !== "ALL" ? (partyFilter as ParticipantRole) : undefined,
    sscc: exactSsccFilter,
    cursor,
    limit: pageSize,
  };

  const summaryQuery = useShipmentSummaryQuery(Boolean(user));
  const shipmentsQuery = useShipmentsQuery(queryFilters, Boolean(user));
  const createPerm = canCreateShipment(user);

  const summary = summaryQuery.data;
  const rawItems = shipmentsQuery.data?.items ?? [];
  const nextCursor = shipmentsQuery.data?.next_cursor ?? null;
  const queryProblem = isApiError(shipmentsQuery.error)
    ? shipmentsQuery.error.problem
    : null;

  // Distinct origins and destinations from loaded shipments for the dropdown filters
  const originOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of rawItems) {
      map.set(s.origin.gln, s.origin.name);
    }
    return Array.from(map.entries());
  }, [rawItems]);

  const destinationOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of rawItems) {
      map.set(s.destination.gln, s.destination.name);
    }
    return Array.from(map.entries());
  }, [rawItems]);

  // Sub-counts within loaded items
  const unassignedCount = useMemo(
    () =>
      rawItems.filter(
        (s) => s.status === "CREATED" && s.assigned_driver_id === null,
      ).length,
    [rawItems],
  );
  const assignedCount = useMemo(
    () =>
      rawItems.filter(
        (s) => s.status === "CREATED" && s.assigned_driver_id !== null,
      ).length,
    [rawItems],
  );

  // Apply client-side refinement (UNASSIGNED vs ASSIGNED, origin, destination, text search)
  const filteredItems = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    return rawItems.filter((item) => {
      if (uiStatusTab === "UNASSIGNED" && item.assigned_driver_id !== null) {
        return false;
      }
      if (uiStatusTab === "ASSIGNED" && item.assigned_driver_id === null) {
        return false;
      }
      if (originFilter !== "ALL" && item.origin.gln !== originFilter) {
        return false;
      }
      if (
        destinationFilter !== "ALL" &&
        item.destination.gln !== destinationFilter
      ) {
        return false;
      }
      if (q && !exactSsccFilter) {
        const shortCode = formatShipmentShortCode(item).toLowerCase();
        const matches =
          item.sscc.includes(q) ||
          shortCode.includes(q) ||
          item.lot.lot_number.toLowerCase().includes(q) ||
          item.product.name.toLowerCase().includes(q) ||
          item.origin.name.toLowerCase().includes(q) ||
          item.destination.name.toLowerCase().includes(q);
        if (!matches) {
          return false;
        }
      }
      return true;
    });
  }, [
    destinationFilter,
    exactSsccFilter,
    originFilter,
    rawItems,
    searchInput,
    uiStatusTab,
  ]);

  const totalShipmentsCount = summary
    ? summary.created +
      summary.in_transit +
      summary.delivered +
      summary.cancelled +
      summary.recalled
    : rawItems.length;

  const totalQuantityInView = useMemo(
    () => filteredItems.reduce((sum, item) => sum + item.quantity, 0),
    [filteredItems],
  );

  function resetFilters() {
    setUiStatusTab("ALL");
    setPartyFilter("ALL");
    setOriginFilter("ALL");
    setDestinationFilter("ALL");
    setSearchInput("");
    setCursor(undefined);
    setCursorStack([]);
  }

  function handleExportCsv() {
    if (filteredItems.length === 0) return;
    const headers = [
      "Shipment Code",
      "SSCC-18",
      "Lot Number",
      "Product Name",
      "GTIN",
      "Quantity",
      "Origin Name",
      "Origin GLN",
      "Destination Name",
      "Destination GLN",
      "Status",
      "Assigned Driver ID",
      "Created At",
    ];
    const rows = filteredItems.map((s) => [
      formatShipmentShortCode(s),
      s.sscc,
      s.lot.lot_number,
      `"${s.product.name.replace(/"/g, '""')}"`,
      s.product.gtin,
      String(s.quantity),
      `"${s.origin.name.replace(/"/g, '""')}"`,
      s.origin.gln,
      `"${s.destination.name.replace(/"/g, '""')}"`,
      s.destination.gln,
      s.status === "CREATED" && s.assigned_driver_id ? "ASSIGNED" : s.status,
      s.assigned_driver_id ?? "",
      s.created_at,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shipments-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
            <span>Vận chuyển &amp; Điều phối</span>
            <span>›</span>
            <span className="text-slate-700">Quản lý vận đơn</span>
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
            Quản lý Vận đơn
          </h1>
          <p className="mt-0.5 text-sm font-medium text-slate-500">
            Theo dõi vận đơn, kiểm tra trạng thái và chuyển tiếp điều phối.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredItems.length === 0}
            className="h-9 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Download className="size-3.5" />
            <span>Xuất danh sách</span>
          </Button>
          {createPerm.allowed && (
            <Button
              asChild
              className="h-9 rounded-xl bg-[#0F172A] px-4 text-xs font-bold text-white hover:bg-[#1E293B]"
            >
              <Link href="/shipments/new">
                <Plus className="size-4" />
                <span>Tạo vận đơn mới</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Tổng vận đơn
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-slate-900">
            {totalShipmentsCount}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">
            Trong danh sách hiện tại ({filteredItems.length})
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Chờ điều phối
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-[#2563EB]">
            {uiStatusTab === "ALL" ? unassignedCount : (summary?.created ?? 0)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">
            Trạng thái CREATED ({summary?.created ?? 0} tổng)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Đã gán xe / Đang giao
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-slate-900">
            {assignedCount + (summary?.in_transit ?? 0)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">
            {assignedCount} ASSIGNED · {summary?.in_transit ?? 0} IN_TRANSIT ·{" "}
            {summary?.delivered ?? 0} DELIVERED
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Tổng số lượng
          </div>
          <div className="mt-1.5 font-mono text-2xl font-extrabold text-slate-900">
            {formatQuantity(totalQuantityInView, locale)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-400">
            thùng hàng / đơn vị
          </div>
        </div>
      </div>

      {/* Filter & Search Box */}
      <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-72 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3.5 size-4 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setCursor(undefined);
                setCursorStack([]);
              }}
              placeholder="Tìm theo mã vận đơn, SSCC-18 hoặc mã lô hàng..."
              className="h-9 rounded-xl border-slate-200 bg-slate-50/70 pl-9 text-xs font-medium"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  id: "ALL",
                  label: `Tất cả (${rawItems.length})`,
                },
                {
                  id: "UNASSIGNED",
                  label: `Chờ điều phối (${unassignedCount})`,
                },
                {
                  id: "ASSIGNED",
                  label: `Đã gán xe (${assignedCount})`,
                },
                {
                  id: "IN_TRANSIT",
                  label: `${tStatus("IN_TRANSIT")} (${summary?.in_transit ?? 0})`,
                },
                {
                  id: "DELIVERED",
                  label: `${tStatus("DELIVERED")} (${summary?.delivered ?? 0})`,
                },
                {
                  id: "CANCELLED",
                  label: `${tStatus("CANCELLED")} (${summary?.cancelled ?? 0})`,
                },
                {
                  id: "RECALLED",
                  label: `${tStatus("RECALLED")} (${summary?.recalled ?? 0})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setUiStatusTab(tab.id);
                  setCursor(undefined);
                  setCursorStack([]);
                }}
                className={cn(
                  "cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold transition",
                  uiStatusTab === tab.id
                    ? "bg-[#0F172A] text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Kho xuất phát
            </span>
            <Select value={originFilter} onValueChange={setOriginFilter}>
              <SelectTrigger className="h-9 w-full rounded-xl text-xs font-semibold">
                <SelectValue placeholder="Tất cả kho" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả kho</SelectItem>
                {originOptions.map(([gln, name]) => (
                  <SelectItem key={gln} value={gln}>
                    {name} ({gln})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Điểm nhận hàng
            </span>
            <Select
              value={destinationFilter}
              onValueChange={setDestinationFilter}
            >
              <SelectTrigger className="h-9 w-full rounded-xl text-xs font-semibold">
                <SelectValue placeholder="Tất cả điểm nhận" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả điểm nhận</SelectItem>
                {destinationOptions.map(([gln, name]) => (
                  <SelectItem key={gln} value={gln}>
                    {name} ({gln})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-500">
              Vai trò tham gia (Party)
            </span>
            <Select
              value={partyFilter}
              onValueChange={(val) => {
                setPartyFilter(val);
                setCursor(undefined);
                setCursorStack([]);
              }}
            >
              <SelectTrigger className="h-9 w-full rounded-xl text-xs font-semibold">
                <SelectValue placeholder="Tất cả vai trò" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả vai trò</SelectItem>
                {PARTY_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {tParty(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-9 w-full rounded-xl border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 sm:w-auto"
            >
              Xóa bộ lọc
            </Button>
          </div>
        </div>
      </div>

      <ProblemBanner problem={queryProblem} />

      {/* Shipments Table Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Danh sách vận đơn
            </h2>
            <p className="mt-0.5 text-xs font-medium text-slate-400">
              {filteredItems.length} vận đơn · {unassignedCount} chờ điều phối ·{" "}
              {assignedCount} đã gán xe
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
              <Filter className="size-3.5" />
              <span>
                {uiStatusTab === "ALL" ? "Tất cả trạng thái" : uiStatusTab}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void shipmentsQuery.refetch();
                void summaryQuery.refetch();
              }}
              disabled={shipmentsQuery.isFetching}
              className="h-8 rounded-lg border-slate-200 text-xs font-bold text-slate-700"
            >
              <RefreshCw
                className={cn(
                  "size-3.5",
                  shipmentsQuery.isFetching && "animate-spin",
                )}
              />
              <span>Làm mới</span>
            </Button>
          </div>
        </div>

        {shipmentsQuery.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((row) => (
              <div
                key={row}
                className="h-16 animate-pulse rounded-xl bg-slate-100"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Truck className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="font-bold text-slate-900">{t("emptyTitle")}</p>
              <p className="text-xs text-slate-500">{t("emptyDescription")}</p>
            </div>
            {createPerm.allowed && (
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-[#0F172A] text-white hover:bg-[#1E293B]"
              >
                <Link href="/shipments/new">
                  <Plus className="size-4" />
                  <span>Tạo vận đơn mới</span>
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                <TableHead className="pl-6">MÃ VẬN ĐƠN / SSCC-18</TableHead>
                <TableHead>LÔ HÀNG (LOT)</TableHead>
                <TableHead>SỐ LƯỢNG</TableHead>
                <TableHead>ĐIỂM XUẤT (ORIGIN)</TableHead>
                <TableHead>ĐIỂM NHẬN (DESTINATION)</TableHead>
                <TableHead>TRẠNG THÁI</TableHead>
                <TableHead className="pr-6 text-right">THAO TÁC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((shipment) => {
                const shortCode = formatShipmentShortCode(shipment);
                const isAssignedCreated =
                  shipment.status === "CREATED" &&
                  shipment.assigned_driver_id !== null;
                const isUnassignedCreated =
                  shipment.status === "CREATED" &&
                  shipment.assigned_driver_id === null;

                const targetStep = isUnassignedCreated
                  ? "2"
                  : isAssignedCreated
                    ? "3"
                    : "4";

                return (
                  <TableRow
                    key={shipment.id}
                    className="border-b border-slate-100 hover:bg-slate-50/70"
                  >
                    <TableCell className="py-4 pl-6">
                      <Link
                        href={`/shipments/${shipment.id}?step=${targetStep}`}
                        className="font-mono text-xs font-extrabold text-[#2563EB] hover:underline"
                      >
                        {shortCode}
                      </Link>
                      <div className="mt-0.5 font-mono text-[11px] font-medium text-slate-400">
                        (00) {formatSscc(shipment.sscc)}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="font-mono text-xs font-bold text-slate-900">
                        {shipment.lot.lot_number}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-slate-500">
                        {shipment.product.name}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="font-mono text-xs font-extrabold text-slate-900">
                        {formatQuantity(shipment.quantity, locale)}
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-400">
                        thùng
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="text-xs font-bold text-slate-800">
                        {shipment.origin.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        GLN: {shipment.origin.gln}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      <div className="text-xs font-bold text-slate-800">
                        {shipment.destination.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                        GLN: {shipment.destination.gln}
                      </div>
                    </TableCell>

                    <TableCell className="py-4">
                      {isUnassignedCreated && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 font-mono text-[11px] font-bold text-[#2563EB]">
                          CREATED
                        </span>
                      )}
                      {isAssignedCreated && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-700">
                          ASSIGNED
                        </span>
                      )}
                      {shipment.status === "IN_TRANSIT" && (
                        <span className="inline-flex items-center rounded-md bg-sky-50 px-2.5 py-1 font-mono text-[11px] font-bold text-sky-700">
                          IN_TRANSIT
                        </span>
                      )}
                      {shipment.status === "DELIVERED" && (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-700">
                          DELIVERED
                        </span>
                      )}
                      {shipment.status === "CANCELLED" && (
                        <span className="inline-flex items-center rounded-md bg-neutral-100 px-2.5 py-1 font-mono text-[11px] font-bold text-neutral-600">
                          CANCELLED
                        </span>
                      )}
                      {shipment.status === "RECALLED" && (
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-2.5 py-1 font-mono text-[11px] font-bold text-rose-700">
                          RECALLED
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-4 pr-6 text-right">
                      {isUnassignedCreated ? (
                        <Button
                          asChild
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg bg-[#0F172A] px-3 text-xs font-bold text-white hover:bg-[#1E293B]"
                        >
                          <Link href={`/shipments/${shipment.id}?step=2`}>
                            <span>Điều phối</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : isAssignedCreated ? (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          <Link href={`/shipments/${shipment.id}?step=3`}>
                            <span>Đã gán xe</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 rounded-lg border-slate-200 px-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
                        >
                          <Link href={`/shipments/${shipment.id}?step=4`}>
                            <span>Hành trình</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3.5 text-xs text-slate-500">
          <div>
            Hiển thị{" "}
            <span className="font-bold text-slate-800">
              {filteredItems.length === 0 ? 0 : 1}–{filteredItems.length}
            </span>{" "}
            trong{" "}
            <span className="font-bold text-slate-800">
              {totalShipmentsCount}
            </span>{" "}
            vận đơn
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                setCursor(undefined);
                setCursorStack([]);
              }}
            >
              <SelectTrigger className="h-8 w-28 rounded-lg text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 / trang</SelectItem>
                <SelectItem value="20">20 / trang</SelectItem>
                <SelectItem value="50">50 / trang</SelectItem>
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={cursorStack.length === 0 || shipmentsQuery.isFetching}
              onClick={() => {
                const nextStack = [...cursorStack];
                const prev = nextStack.pop();
                setCursorStack(nextStack);
                setCursor(prev === "__FIRST__" ? undefined : prev);
              }}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              Trước
            </Button>

            <span className="inline-flex size-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 font-mono text-xs font-bold text-[#2563EB]">
              {cursorStack.length + 1}
            </span>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nextCursor || shipmentsQuery.isFetching}
              onClick={() => {
                if (!nextCursor) return;
                setCursorStack((prev) => [...prev, cursor ?? "__FIRST__"]);
                setCursor(nextCursor);
              }}
              className="h-8 rounded-lg text-xs font-semibold"
            >
              Sau
            </Button>
          </div>
        </div>
      </div>

      <p className="text-[11px] font-medium text-slate-400">
        Dữ liệu hiển thị theo tenant {user?.tenant.code} · Mã SSCC-18 &amp; GLN
        theo tiêu chuẩn GS1.
      </p>
    </section>
  );
}
