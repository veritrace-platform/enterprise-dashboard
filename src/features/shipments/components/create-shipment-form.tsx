"use client";

import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  MapPin,
  QrCode,
  Search,
  Truck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";
import { z } from "zod";
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
import { Link, useRouter } from "@/i18n/navigation";
import { type ApiProblem, isApiError } from "@/lib/api/errors";
import { validateGln } from "@/lib/gs1/gln";
import { cn } from "@/lib/utils";
import { formatQuantity, formatTemperature } from "@/utils/format";
import { lookupDirectoryLocation, lookupDirectoryTenant } from "../api";
import {
  useActiveDriversQuery,
  useAvailableInventoryQuery,
  useCreateShipmentMutation,
  useLocationsListQuery,
  useLotsListQuery,
} from "../queries/queries";
import type { DirectoryLocation, DirectoryTenant } from "../types";

const createShipmentFormSchema = z.object({
  balanceKey: z.string().min(1),
  quantity: z.number().int().positive(),
  destinationGln: z.string().regex(/^[0-9]{13}$/),
  carrierTenantCode: z.string().trim().optional(),
  driverUserId: z.string().optional(),
});

function computeHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export function CreateShipmentForm() {
  const { user } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("shipments.create");
  const tErrors = useTranslations("errors");

  const lotSelectId = useId();
  const originSelectId = useId();
  const quantityInputId = useId();
  const glnInputId = useId();
  const carrierInputId = useId();
  const driverSelectId = useId();

  const inventoryQuery = useAvailableInventoryQuery(Boolean(user));
  const lotsQuery = useLotsListQuery(Boolean(user));
  const locationsQuery = useLocationsListQuery(Boolean(user?.role === "ADMIN"));
  const driversQuery = useActiveDriversQuery(Boolean(user));
  const createMutation = useCreateShipmentMutation();

  const [balanceKey, setBalanceKey] = useState("");
  const [quantityText, setQuantityText] = useState("1");
  const [destinationGln, setDestinationGln] = useState("");
  const [transportMode, setTransportMode] = useState<"IN_HOUSE" | "EXTERNAL">(
    "IN_HOUSE",
  );
  const [carrierCode, setCarrierCode] = useState("");
  const [driverUserId, setDriverUserId] = useState<string>("NONE");

  const [resolvedDestination, setResolvedDestination] =
    useState<DirectoryLocation | null>(null);
  const [resolvedCarrier, setResolvedCarrier] =
    useState<DirectoryTenant | null>(null);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const activeBalances = useMemo(
    () =>
      (inventoryQuery.data?.items ?? []).filter(
        (item) => item.lot.status === "ACTIVE" && item.quantity_on_hand > 0,
      ),
    [inventoryQuery.data?.items],
  );

  // Auto-select first balance when loaded if none selected yet
  const effectiveBalanceKey =
    balanceKey ||
    (activeBalances[0]
      ? `${activeBalances[0].lot.id}:${activeBalances[0].location.id}`
      : "");

  const selectedBalance = useMemo(
    () =>
      activeBalances.find(
        (b) => `${b.lot.id}:${b.location.id}` === effectiveBalanceKey,
      ) ?? null,
    [activeBalances, effectiveBalanceKey],
  );

  const selectedLotDetail = useMemo(
    () =>
      (lotsQuery.data?.items ?? []).find(
        (l) => l.id === selectedBalance?.lot.id,
      ) ?? null,
    [lotsQuery.data?.items, selectedBalance?.lot.id],
  );

  const originLocationDetail = useMemo(
    () =>
      (locationsQuery.data?.items ?? []).find(
        (loc) => loc.id === selectedBalance?.location.id,
      ) ?? null,
    [locationsQuery.data?.items, selectedBalance?.location.id],
  );

  const glnValidation = useMemo(() => {
    if (!destinationGln) {
      return null;
    }
    return validateGln(destinationGln);
  }, [destinationGln]);

  const distanceKm = useMemo(() => {
    if (!originLocationDetail || !resolvedDestination) {
      return null;
    }
    return computeHaversineKm(
      originLocationDetail.latitude,
      originLocationDetail.longitude,
      resolvedDestination.latitude,
      resolvedDestination.longitude,
    );
  }, [originLocationDetail, resolvedDestination]);

  const parsedQuantity = Number(quantityText);
  const isQuantityValid =
    Number.isInteger(parsedQuantity) &&
    parsedQuantity > 0 &&
    Boolean(
      selectedBalance && parsedQuantity <= selectedBalance.quantity_on_hand,
    );

  const isGlnDistinctAndValid = Boolean(
    glnValidation?.valid &&
      selectedBalance &&
      destinationGln !== selectedBalance.location.gln,
  );

  async function handleLookupDestination() {
    const check = validateGln(destinationGln);
    if (!check.valid) {
      setFieldErrors((prev) => ({
        ...prev,
        destination_gln: tErrors(`field.${check.code}`),
      }));
      return;
    }
    setProblem(null);
    try {
      const location = await lookupDirectoryLocation(destinationGln);
      setResolvedDestination(location);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.destination_gln;
        return next;
      });
    } catch (error) {
      setResolvedDestination(null);
      if (isApiError(error)) {
        setProblem(error.problem);
      }
    }
  }

  async function handleLookupCarrier() {
    const code = carrierCode.trim();
    if (!code) {
      setResolvedCarrier(null);
      return;
    }
    setProblem(null);
    try {
      const tenant = await lookupDirectoryTenant(code);
      setResolvedCarrier(tenant);
    } catch (error) {
      setResolvedCarrier(null);
      if (isApiError(error)) {
        setProblem(error.problem);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);

    const nextFieldErrors: Record<string, string> = {};
    const quantity = Number(quantityText);

    if (!selectedBalance) {
      nextFieldErrors.lot_id = tErrors("field.REQUIRED");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      nextFieldErrors.quantity = tErrors("field.OUT_OF_RANGE");
    } else if (selectedBalance && quantity > selectedBalance.quantity_on_hand) {
      nextFieldErrors.quantity = tErrors("INSUFFICIENT_STOCK");
    }

    const glnCheck = validateGln(destinationGln);
    if (!glnCheck.valid) {
      nextFieldErrors.destination_gln = tErrors(`field.${glnCheck.code}`);
    } else if (
      selectedBalance &&
      destinationGln === selectedBalance.location.gln
    ) {
      nextFieldErrors.destination_gln = tErrors("field.INVALID_VALUE");
    }

    const parsed = createShipmentFormSchema.safeParse({
      balanceKey: effectiveBalanceKey,
      quantity,
      destinationGln,
      carrierTenantCode:
        transportMode === "EXTERNAL" && carrierCode.trim()
          ? carrierCode.trim()
          : undefined,
      driverUserId:
        transportMode === "IN_HOUSE" && driverUserId !== "NONE"
          ? driverUserId
          : undefined,
    });

    if (!parsed.success || Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      return;
    }

    if (!selectedBalance) {
      return;
    }

    setFieldErrors({});

    try {
      const created = await createMutation.mutateAsync({
        lot_id: selectedBalance.lot.id,
        origin_location_id: selectedBalance.location.id,
        quantity,
        destination_gln: destinationGln,
        carrier_tenant_code:
          transportMode === "EXTERNAL" && carrierCode.trim()
            ? carrierCode.trim()
            : null,
        driver_user_id:
          transportMode === "IN_HOUSE" && driverUserId !== "NONE"
            ? driverUserId
            : null,
      });

      router.push(`/shipments/${created.id}?step=2`);
    } catch (error) {
      if (isApiError(error)) {
        setProblem(error.problem);
        if (error.problem.errors) {
          const mapped: Record<string, string> = {};
          for (const fieldErr of error.problem.errors) {
            mapped[fieldErr.field] = tErrors(`field.${fieldErr.code}`);
          }
          setFieldErrors(mapped);
        }
      }
    }
  }

  const gcp = user?.tenant.gs1_company_prefix ?? "8930001";
  const serialLen = Math.max(1, 16 - gcp.length);
  const sampleSerial = "1".padStart(serialLen, "0");

  return (
    <section className="space-y-5 pb-10">
      {/* Header */}
      <header>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <Link href="/shipments" className="hover:text-slate-700">
            Vận chuyển &amp; Điều phối
          </Link>
          <span>›</span>
          <span className="text-[#2563EB]">Tạo vận đơn</span>
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Lập Vận Đơn Mới
        </h1>
      </header>

      {/* 4-Step Horizontal Stepper */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs sm:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl bg-[#0F172A] px-4 py-3 text-white shadow-xs">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2563EB] font-mono text-xs font-bold text-white">
            1
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase">
              BƯỚC 1 · ĐANG THỰC HIỆN
            </div>
            <div className="truncate text-xs font-bold text-white">
              Lập vận đơn
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-slate-400">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200/80 font-mono text-xs font-bold text-slate-500">
            2
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider uppercase">
              BƯỚC 2
            </div>
            <div className="truncate text-xs font-bold text-slate-600">
              Điều phối &amp; Tài xế
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-slate-400">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200/80 font-mono text-xs font-bold text-slate-500">
            3
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider uppercase">
              BƯỚC 3
            </div>
            <div className="truncate text-xs font-bold text-slate-600">
              Xuất kho &amp; Pickup Dock
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-slate-400">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200/80 font-mono text-xs font-bold text-slate-500">
            4
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider uppercase">
              BƯỚC 4
            </div>
            <div className="truncate text-xs font-bold text-slate-600">
              Vận chuyển &amp; ePOD
            </div>
          </div>
        </div>
      </div>

      <ProblemBanner problem={problem} />

      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        {/* Left Column (7 cols) */}
        <div className="space-y-5 lg:col-span-7">
          {/* Card 1: Thông tin Lô hàng & Số lượng */}
          <fieldset className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <Boxes className="size-4" />
              </span>
              <legend className="text-sm font-extrabold text-slate-900">
                Thông tin Lô hàng &amp; Số lượng
              </legend>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={lotSelectId}
                className="text-xs font-bold text-slate-700"
              >
                Chọn Lô Hàng Xuất (Lot ID) <span className="text-rose-600">*</span>
              </label>
              <Select
                value={effectiveBalanceKey}
                onValueChange={(val) => {
                  setBalanceKey(val);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.lot_id;
                    return next;
                  });
                }}
              >
                <SelectTrigger
                  id={lotSelectId}
                  className="h-10 w-full rounded-xl text-xs font-semibold"
                >
                  <SelectValue placeholder={t("lotPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {activeBalances.map((balance) => {
                    const key = `${balance.lot.id}:${balance.location.id}`;
                    return (
                      <SelectItem key={key} value={key} className="text-xs">
                        {balance.lot.lot_number} - {balance.lot.product_name}{" "}
                        (GTIN: {balance.lot.gtin}, HSD:{" "}
                        {balance.lot.expiration_date})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {fieldErrors.lot_id && (
                <p className="text-xs font-semibold text-rose-600">
                  {fieldErrors.lot_id}
                </p>
              )}
            </div>

            {selectedBalance && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200/80 bg-blue-50/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-blue-100/80 text-[#2563EB]">
                    <Boxes className="size-4" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      Tồn kho khả dụng tại {selectedBalance.location.name}
                    </div>
                    <div className="font-mono text-[11px] font-medium text-slate-500">
                      GTIN: {selectedBalance.lot.gtin} · HSD:{" "}
                      {selectedBalance.lot.expiration_date}
                    </div>
                  </div>
                </div>
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-mono text-xs font-extrabold text-slate-900 shadow-2xs">
                  {formatQuantity(selectedBalance.quantity_on_hand, locale)}{" "}
                  thùng
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor={quantityInputId}
                  className="text-xs font-bold text-slate-700"
                >
                  Số lượng xuất (Quantity){" "}
                  <span className="text-rose-600">*</span>
                </label>
                {selectedBalance && (
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold",
                      isQuantityValid ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {isQuantityValid
                      ? `Hợp lệ (<= ${selectedBalance.quantity_on_hand})`
                      : `Vượt tồn kho (tối đa ${selectedBalance.quantity_on_hand})`}
                  </span>
                )}
              </div>
              <div className="relative">
                <Input
                  id={quantityInputId}
                  type="number"
                  min={1}
                  max={selectedBalance?.quantity_on_hand}
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.quantity)}
                  className="h-10 rounded-xl pr-16 font-mono text-xs font-bold"
                />
                <span className="pointer-events-none absolute top-2.5 right-3.5 text-xs font-semibold text-slate-400">
                  thùng
                </span>
              </div>
              {fieldErrors.quantity && (
                <p className="text-xs font-semibold text-rose-600">
                  {fieldErrors.quantity}
                </p>
              )}
            </div>
          </fieldset>

          {/* Card 2: Cơ sở Xuất & Điểm nhận hàng */}
          <fieldset className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <MapPin className="size-4" />
              </span>
              <legend className="text-sm font-extrabold text-slate-900">
                Cơ sở Xuất &amp; Điểm nhận hàng
              </legend>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={originSelectId}
                className="text-xs font-bold text-slate-700"
              >
                Kho xuất phát <span className="text-rose-600">*</span>
              </label>
              <Select
                value={effectiveBalanceKey}
                onValueChange={(val) => setBalanceKey(val)}
              >
                <SelectTrigger
                  id={originSelectId}
                  className="h-10 w-full rounded-xl text-xs font-semibold"
                >
                  <SelectValue placeholder="Chọn kho xuất phát" />
                </SelectTrigger>
                <SelectContent>
                  {activeBalances.map((balance) => {
                    const key = `${balance.lot.id}:${balance.location.id}`;
                    return (
                      <SelectItem key={key} value={key} className="text-xs">
                        {balance.location.name} (GLN: {balance.location.gln}) —{" "}
                        Lô {balance.lot.lot_number}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={glnInputId}
                className="text-xs font-bold text-slate-700"
              >
                GLN Điểm nhận <span className="text-rose-600">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  id={glnInputId}
                  inputMode="numeric"
                  placeholder="Nhập mã GLN 13 chữ số (VD: 8934567000017)"
                  value={destinationGln}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 13);
                    setDestinationGln(digits);
                    setResolvedDestination(null);
                  }}
                  className="h-10 rounded-xl font-mono text-xs font-bold"
                  aria-invalid={Boolean(fieldErrors.destination_gln)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleLookupDestination()}
                  disabled={destinationGln.length !== 13}
                  className="h-10 rounded-xl border-blue-200 bg-blue-50/70 px-4 text-xs font-bold text-[#2563EB] hover:bg-blue-100/70"
                >
                  <Search className="size-3.5" />
                  <span>Thư mục GLN</span>
                </Button>
              </div>
              {fieldErrors.destination_gln && (
                <p className="text-xs font-semibold text-rose-600">
                  {fieldErrors.destination_gln}
                </p>
              )}
            </div>

            {resolvedDestination && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#2563EB]" />
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        {resolvedDestination.name}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-slate-500">
                        {resolvedDestination.address},{" "}
                        {resolvedDestination.city}
                      </div>
                    </div>
                  </div>
                  <span className="rounded-md bg-blue-100/80 px-2 py-0.5 text-[10px] font-bold text-[#2563EB]">
                    GLN Đã xác thực
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-2.5 text-[11px] text-slate-600">
                  <div>
                    <span className="text-slate-400">Đối tác: </span>
                    <span className="font-bold text-slate-800">
                      {resolvedDestination.tenant.legal_name} (
                      {resolvedDestination.tenant.code})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Geo-fence: </span>
                    <span className="font-mono font-bold text-slate-800">
                      {resolvedDestination.geo_fence_radius_meters}m
                    </span>
                  </div>
                  {distanceKm !== null && (
                    <div className="font-mono font-bold text-[#2563EB]">
                      • Khoảng cách: {distanceKm} km
                    </div>
                  )}
                </div>
              </div>
            )}
          </fieldset>

          {/* Card 3: Phương thức vận chuyển ban đầu */}
          <fieldset className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <Truck className="size-4" />
              </span>
              <div>
                <legend className="text-sm font-extrabold text-slate-900">
                  Phương thức vận chuyển ban đầu
                </legend>
                <p className="text-xs font-medium text-slate-400">
                  Chọn đội xe nội bộ hoặc giao phó cho đối tác 3PL (có thể điều
                  chỉnh ở Bước 2)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setTransportMode("IN_HOUSE");
                  setCarrierCode("");
                  setResolvedCarrier(null);
                }}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition",
                  transportMode === "IN_HOUSE"
                    ? "border-[#2563EB] bg-blue-50/40 ring-2 ring-[#2563EB]/15"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    transportMode === "IN_HOUSE"
                      ? "border-[#2563EB] bg-[#2563EB]"
                      : "border-slate-300",
                  )}
                >
                  {transportMode === "IN_HOUSE" && (
                    <span className="size-1.5 rounded-full bg-white" />
                  )}
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Tự vận chuyển
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-500">
                    Đội xe tải lạnh trực thuộc {user?.tenant.code}. Giám sát
                    sensor IoT trực tiếp qua Control Tower.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTransportMode("EXTERNAL");
                  setDriverUserId("NONE");
                }}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition",
                  transportMode === "EXTERNAL"
                    ? "border-[#2563EB] bg-blue-50/40 ring-2 ring-[#2563EB]/15"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    transportMode === "EXTERNAL"
                      ? "border-[#2563EB] bg-[#2563EB]"
                      : "border-slate-300",
                  )}
                >
                  {transportMode === "EXTERNAL" && (
                    <span className="size-1.5 rounded-full bg-white" />
                  )}
                </span>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Thuê vận tải ngoài
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed font-medium text-slate-500">
                    Đối tác Logistics bên thứ 3. Cung cấp mã đối tác hoặc điều
                    phối ở bước kế tiếp.
                  </p>
                </div>
              </button>
            </div>

            {transportMode === "IN_HOUSE" ? (
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor={driverSelectId}
                  className="text-xs font-bold text-slate-700"
                >
                  Chỉ định Tài xế nội bộ (Tùy chọn — có thể gán ở Bước 2)
                </label>
                <Select value={driverUserId} onValueChange={setDriverUserId}>
                  <SelectTrigger
                    id={driverSelectId}
                    className="h-10 w-full rounded-xl text-xs font-semibold"
                  >
                    <SelectValue placeholder={t("driverPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE" className="text-xs">
                      Chưa gán tài xế (Điều phối ở Bước 2)
                    </SelectItem>
                    {(driversQuery.data?.items ?? []).map((driver) => (
                      <SelectItem
                        key={driver.id}
                        value={driver.id}
                        className="text-xs"
                      >
                        {driver.full_name} ({driver.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor={carrierInputId}
                  className="text-xs font-bold text-slate-700"
                >
                  Mã Tenant Đối tác 3PL (Tùy chọn — có thể điều phối ở Bước 2)
                </label>
                <div className="flex gap-2">
                  <Input
                    id={carrierInputId}
                    placeholder="VD: MEKONG_LOGISTICS"
                    value={carrierCode}
                    onChange={(e) => {
                      setCarrierCode(e.target.value.toUpperCase());
                      setResolvedCarrier(null);
                    }}
                    className="h-10 rounded-xl font-mono text-xs font-bold uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleLookupCarrier()}
                    disabled={!carrierCode.trim()}
                    className="h-10 rounded-xl text-xs font-bold"
                  >
                    <Search className="size-3.5" />
                    <span>Tra cứu</span>
                  </Button>
                </div>
                {resolvedCarrier && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    <span>
                      {resolvedCarrier.legal_name} ({resolvedCarrier.code})
                    </span>
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>

        {/* Right Column (5 cols) */}
        <aside className="space-y-5 lg:col-span-5">
          {/* Card 1: Cấp mã GS1 SSCC-18 Tự Động */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                  <QrCode className="size-4" />
                </span>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Cấp mã GS1 SSCC-18 Tự Động
                </h2>
              </div>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-bold text-[#2563EB]">
                GCP: {gcp}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-[#0F172A] p-5 text-center text-white">
              <div className="font-mono text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                GS1 AI (00) APPLICATION IDENTIFIER
              </div>
              <div className="mt-2 font-mono text-xl font-extrabold tracking-wider text-white">
                (00) 0 {gcp} {sampleSerial} •
              </div>
              <div className="mt-2 text-[11px] font-medium text-blue-300">
                Trạng thái: Cấp tự động từ chuỗi Serial của Tenant
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-bold text-slate-600">
                Cấu trúc phân giải mã SSCC-18:
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="font-mono text-xs font-bold text-slate-800">
                    0
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                    Extension
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {gcp}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                    Company GCP
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-2">
                  <div className="truncate font-mono text-xs font-bold text-[#2563EB]">
                    {sampleSerial}
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                    Serial
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-2">
                  <div className="font-mono text-xs font-bold text-slate-800">
                    Mod10
                  </div>
                  <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                    Mod10 Check
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Kiểm tra Ràng buộc Nghiệp vụ */}
          <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <ClipboardCheck className="size-4" />
              </span>
              <h2 className="text-sm font-extrabold text-slate-900">
                Kiểm tra Ràng buộc Nghiệp vụ
              </h2>
            </div>

            <ul className="space-y-2.5 text-xs">
              {[
                {
                  label: `Trạng thái lô hàng: ${selectedBalance?.lot.lot_number ?? "—"} is ACTIVE`,
                  passed: selectedBalance?.lot.status === "ACTIVE",
                },
                {
                  label: `Tồn kho đủ xuất (${Number.isInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 0} thùng <= ${selectedBalance?.quantity_on_hand ?? 0} khả dụng)`,
                  passed: isQuantityValid,
                },
                {
                  label: `Kho xuất trực thuộc Tenant (GCP ${gcp})`,
                  passed: Boolean(selectedBalance),
                },
                {
                  label: "GLN điểm nhận hợp lệ & khác GLN xuất",
                  passed: isGlnDistinctAndValid,
                },
                {
                  label: selectedLotDetail
                    ? `Dải kiểm soát nhiệt độ lạnh: ${formatTemperature(selectedLotDetail.min_temp_celsius)} – ${formatTemperature(selectedLotDetail.max_temp_celsius)}`
                    : "Dải kiểm soát nhiệt độ lạnh theo chuẩn sản phẩm",
                  passed: Boolean(selectedBalance),
                },
              ].map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5"
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <CheckCircle2
                      className={cn(
                        "size-4 shrink-0",
                        item.passed ? "text-[#2563EB]" : "text-slate-300",
                      )}
                    />
                    <span>{item.label}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                      item.passed
                        ? "bg-blue-50 text-[#2563EB]"
                        : "bg-slate-200/70 text-slate-500",
                    )}
                  >
                    {item.passed ? "PASS" : "WAIT"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="space-y-2.5 pt-2">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-11 w-full gap-2 rounded-xl bg-[#0F172A] text-xs font-extrabold text-white hover:bg-[#1E293B]"
              >
                <span>
                  {createMutation.isPending
                    ? t("submitting")
                    : "Khởi tạo Vận đơn & Chuyển sang Điều phối"}
                </span>
                <ArrowRight className="size-4" />
              </Button>

              <Button
                type="button"
                variant="outline"
                asChild
                className="h-10 w-full rounded-xl border-slate-200 text-xs font-bold text-slate-700"
              >
                <Link href="/shipments">Quay lại Danh sách vận đơn</Link>
              </Button>
            </div>
          </div>
        </aside>
      </form>
    </section>
  );
}
