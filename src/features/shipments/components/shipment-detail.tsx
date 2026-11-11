"use client";

import bwipjs from "bwip-js";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  KeyRound,
  Link2,
  LocateFixed,
  MapPin,
  Navigation,
  PackageCheck,
  Printer,
  QrCode,
  Radio,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Thermometer,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link, useRouter } from "@/i18n/navigation";
import { type ApiProblem, isApiError } from "@/lib/api/errors";
import {
  canAssignCarrier,
  canAssignDriver,
  canCancelShipment,
  canConfirmDelivery,
  canIssuePickupCode,
  canPrintLogisticLabel,
  canRecallLot,
  hasExternalCarrier,
} from "@/lib/auth/permission";
import { formatSscc, parseAndValidateSscc } from "@/lib/gs1/sscc";
import type { NotificationReading } from "@/lib/realtime/events";
import { cn } from "@/lib/utils";
import {
  formatDateTime,
  formatQuantity,
  formatTemperature,
} from "@/utils/format";
import { lookupDirectoryTenant } from "../api";
import {
  useActiveDriversQuery,
  useAssignCarrierMutation,
  useAssignDriverMutation,
  useCancelShipmentMutation,
  useConfirmDeliveryMutation,
  useIssuePickupCodeMutation,
  useRecallShipmentLotMutation,
  useShipmentDetailQuery,
  useShipmentEventsQuery,
  useShipmentIncidentsQuery,
  useShipmentReadingsQuery,
  useVerifyShipmentIntegrityMutation,
} from "../queries/queries";
import type {
  DirectoryTenant,
  Integrity,
  PickupCode,
  Position,
  Reading,
  ShipmentEvent,
} from "../types";

const carrierSchema = z.object({
  carrierTenantCode: z.string().trim().min(2).max(32),
});

const driverSchema = z.object({
  driverUserId: z.string().min(1),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

type ActiveDialog = "delivery" | "cancel" | "recall" | null;
type DetailStep = "2" | "3" | "4";

function computeHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
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

function getEventDisplayTitle(eventType: string): string {
  switch (eventType) {
    case "shipment.created":
      return "Khởi tạo Vận đơn";
    case "shipment.participant_added":
      return "Điều phối Đối tác Vận tải";
    case "shipment.driver_assigned":
      return "Phân công Tài xế";
    case "shipment.pickup_confirmed":
      return "Tài xế xác nhận Đơn hàng (Pickup)";
    case "shipment.checkpoint_recorded":
      return "shipment.checkpoint_recorded";
    case "shipment.delivery_confirmed":
      return "Đối tác xác nhận Nhận hàng (ePOD)";
    case "shipment.cancelled":
      return "Hủy Vận đơn";
    case "shipment.recalled":
      return "Thu hồi Khẩn cấp (Recall)";
    case "shipment.document_attached":
      return "Đính kèm Chứng từ";
    default:
      return eventType;
  }
}

export function ShipmentDetailView({ shipmentId }: { shipmentId: string }) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      }
    >
      <ShipmentDetailContent shipmentId={shipmentId} />
    </Suspense>
  );
}

function ShipmentDetailContent({ shipmentId }: { shipmentId: string }) {
  const { user, subscribeTelemetry } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("shipments.detail");
  const tStatus = useTranslations("status");
  const tErrors = useTranslations("errors");
  const tApp = useTranslations("app");

  const carrierInputId = useId();
  const driverSelectId = useId();
  const ssccInputId = useId();
  const cancelInputId = useId();
  const recallInputId = useId();

  const [manualStep, setManualStep] = useState<DetailStep | null>(null);
  const [resolution, setResolution] = useState<"raw" | "1m" | "15m">("raw");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const detailQuery = useShipmentDetailQuery(shipmentId, Boolean(user));
  const shipment = detailQuery.data;

  const eventsQuery = useShipmentEventsQuery(shipmentId, Boolean(shipment));
  const readingsQuery = useShipmentReadingsQuery(
    shipment?.sscc,
    resolution,
    Boolean(shipment),
  );
  const incidentsQuery = useShipmentIncidentsQuery(
    shipment?.sscc,
    Boolean(shipment),
  );

  const assignCarrierPerm = shipment
    ? canAssignCarrier(user, shipment)
    : { allowed: false };
  const assignDriverPerm = shipment
    ? canAssignDriver(user, shipment)
    : { allowed: false };
  const issuePickupPerm = shipment
    ? canIssuePickupCode(user, shipment)
    : { allowed: false };
  const confirmDeliveryPerm = shipment
    ? canConfirmDelivery(user, shipment)
    : { allowed: false };
  const cancelPerm = shipment
    ? canCancelShipment(user, shipment)
    : { allowed: false };
  const printLabelPerm = shipment
    ? canPrintLogisticLabel(user, shipment)
    : { allowed: false };
  const recallPerm = shipment
    ? canRecallLot(user, {
      owner_tenant_id: shipment.owner_tenant_id,
      status: shipment.status === "RECALLED" ? "RECALLED" : "ACTIVE",
    })
    : { allowed: false };

  const driversQuery = useActiveDriversQuery(assignDriverPerm.allowed);

  const assignCarrierMutation = useAssignCarrierMutation(shipmentId);
  const assignDriverMutation = useAssignDriverMutation(shipmentId);
  const issuePickupMutation = useIssuePickupCodeMutation(shipmentId);
  const confirmDeliveryMutation = useConfirmDeliveryMutation(shipmentId);
  const cancelMutation = useCancelShipmentMutation(shipmentId);
  const recallMutation = useRecallShipmentLotMutation(shipmentId);
  const integrityMutation = useVerifyShipmentIntegrityMutation(shipmentId);

  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [actionProblem, setActionProblem] = useState<ApiProblem | null>(null);
  const [carrierMode, setCarrierMode] = useState<"EXTERNAL" | "IN_HOUSE">(
    "EXTERNAL",
  );
  const [carrierCodeInput, setCarrierCodeInput] = useState("");
  const [resolvedCarrierTenant, setResolvedCarrierTenant] =
    useState<DirectoryTenant | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [issuedPickupCode, setIssuedPickupCode] = useState<PickupCode | null>(
    null,
  );
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  const [deliverySsccInput, setDeliverySsccInput] = useState("");
  const [acquiredPosition, setAcquiredPosition] = useState<Position | null>(
    null,
  );
  const [isAcquiringGps, setIsAcquiringGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [recallReasonInput, setRecallReasonInput] = useState("");
  const [integrityResult, setIntegrityResult] = useState<Integrity | null>(
    null,
  );
  const [liveReadings, setLiveReadings] = useState<NotificationReading[]>([]);

  // Determine active step from URL query param, manual selection, or shipment status
  const urlStep = searchParams.get("step");
  const activeStep: DetailStep = useMemo(() => {
    if (manualStep) {
      return manualStep;
    }
    if (urlStep === "2" || urlStep === "3" || urlStep === "4") {
      return urlStep;
    }
    if (!shipment) {
      return "2";
    }
    if (shipment.status === "CREATED" && !shipment.assigned_driver_id) {
      return "2";
    }
    if (shipment.status === "CREATED" && shipment.assigned_driver_id) {
      return "3";
    }
    return "4";
  }, [manualStep, shipment, urlStep]);

  function selectStep(step: DetailStep) {
    setManualStep(step);
    setActionProblem(null);
    router.replace(`/shipments/${shipmentId}?step=${step}`);
  }

  // Reset manualStep when URL searchParams change externally (e.g., from Sidebar)
  useEffect(() => {
    if (urlStep === "2" || urlStep === "3" || urlStep === "4") {
      setManualStep(null);
    }
  }, [urlStep]);

  // Pre-fill selected driver from shipment when available
  useEffect(() => {
    if (shipment?.assigned_driver_id && !selectedDriverId) {
      setSelectedDriverId(shipment.assigned_driver_id);
    }
  }, [selectedDriverId, shipment?.assigned_driver_id]);

  // Subscribe to real-time telemetry while IN_TRANSIT
  useEffect(() => {
    if (shipment?.status !== "IN_TRANSIT") {
      return;
    }
    return subscribeTelemetry(shipment.sscc, (reading) => {
      setLiveReadings((prev) => [...prev.slice(-119), reading]);
    });
  }, [shipment, subscribeTelemetry]);

  // Render GS1-128 Barcode on Step 3 voucher canvas
  useEffect(() => {
    if (activeStep !== "3" || !shipment || !barcodeCanvasRef.current) {
      return;
    }
    try {
      bwipjs.toCanvas(barcodeCanvasRef.current, {
        bcid: "gs1-128",
        text: `(00)${shipment.sscc}`,
        scale: 2,
        height: 14,
        includetext: false,
      });
    } catch {
      // Ignore in non-canvas environments
    }
  }, [activeStep, shipment]);

  // Countdown timer for issued 6-digit pickup code
  useEffect(() => {
    if (!issuedPickupCode) {
      return;
    }
    function updateCountdown() {
      if (!issuedPickupCode) {
        return;
      }
      const remainingMs =
        new Date(issuedPickupCode.expires_at).getTime() - Date.now();
      setCountdownSeconds(Math.max(0, Math.floor(remainingMs / 1000)));
    }
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [issuedPickupCode]);

  function copyValue(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  function openDialog(dialog: ActiveDialog) {
    setActionProblem(null);
    setGpsError(null);
    setActiveDialog(dialog);
  }

  function closeDialog() {
    setActiveDialog(null);
    setActionProblem(null);
  }

  async function handleLookupCarrierTenant() {
    const code = carrierCodeInput.trim().toUpperCase();
    if (!code) {
      setResolvedCarrierTenant(null);
      return;
    }
    setActionProblem(null);
    try {
      const tenant = await lookupDirectoryTenant(code);
      setResolvedCarrierTenant(tenant);
    } catch (error) {
      setResolvedCarrierTenant(null);
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleAssignCarrier(e: React.FormEvent) {
    e.preventDefault();
    const parsed = carrierSchema.safeParse({
      carrierTenantCode: carrierCodeInput,
    });
    if (!parsed.success) {
      return;
    }
    setActionProblem(null);
    try {
      await assignCarrierMutation.mutateAsync(
        parsed.data.carrierTenantCode.toUpperCase(),
      );
      setCarrierCodeInput("");
      setResolvedCarrierTenant(null);
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleAssignDriver(e: React.FormEvent) {
    e.preventDefault();
    const parsed = driverSchema.safeParse({ driverUserId: selectedDriverId });
    if (!parsed.success) {
      return;
    }
    setActionProblem(null);
    try {
      await assignDriverMutation.mutateAsync(parsed.data.driverUserId);
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleIssuePickupCode() {
    setActionProblem(null);
    try {
      const code = await issuePickupMutation.mutateAsync();
      setIssuedPickupCode(code);
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  function acquireGeolocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsError(t("locationDenied"));
      return;
    }
    setIsAcquiringGps(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAcquiredPosition({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy_meters: Number((pos.coords.accuracy || 10).toFixed(1)),
        });
        setIsAcquiringGps(false);
      },
      () => {
        setGpsError(t("locationDenied"));
        setIsAcquiringGps(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 0,
      },
    );
  }

  async function handleConfirmDelivery(e: React.FormEvent) {
    e.preventDefault();
    if (!acquiredPosition) {
      setGpsError(t("locationDenied"));
      return;
    }
    const ssccCheck = parseAndValidateSscc(deliverySsccInput);
    if (!ssccCheck.valid) {
      setActionProblem({
        type: "about:blank",
        title: "Unprocessable Content",
        status: 422,
        code: "INVALID_GS1_IDENTIFIER",
        errors: [
          {
            field: "sscc",
            code: ssccCheck.code,
            message: tErrors(`field.${ssccCheck.code}`),
          },
        ],
      });
      return;
    }
    setActionProblem(null);
    try {
      await confirmDeliveryMutation.mutateAsync({
        sscc: ssccCheck.normalized,
        position: acquiredPosition,
      });
      setDeliverySsccInput("");
      closeDialog();
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleCancelShipment(e: React.FormEvent) {
    e.preventDefault();
    const parsed = reasonSchema.safeParse({ reason: cancelReasonInput });
    if (!parsed.success) {
      return;
    }
    setActionProblem(null);
    try {
      await cancelMutation.mutateAsync(parsed.data.reason);
      setCancelReasonInput("");
      closeDialog();
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleRecallLot(e: React.FormEvent) {
    e.preventDefault();
    if (!shipment) return;
    const parsed = reasonSchema.safeParse({ reason: recallReasonInput });
    if (!parsed.success) {
      return;
    }
    setActionProblem(null);
    try {
      await recallMutation.mutateAsync({
        lotId: shipment.lot.id,
        reason: parsed.data.reason,
      });
      setRecallReasonInput("");
      closeDialog();
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  async function handleVerifyIntegrity() {
    setActionProblem(null);
    try {
      const result = await integrityMutation.mutateAsync();
      setIntegrityResult(result);
    } catch (error) {
      if (isApiError(error)) {
        setActionProblem(error.problem);
      }
    }
  }

  const baseReadings = (readingsQuery.data?.items ?? []) as Array<
    Reading & { avg_temperature_celsius?: number; bucket_start?: string }
  >;

  const combinedReadings = useMemo(() => {
    const mappedBase = baseReadings.map((r) => ({
      recorded_at: r.recorded_at ?? r.bucket_start ?? new Date().toISOString(),
      temperature_celsius:
        typeof r.temperature_celsius === "number"
          ? r.temperature_celsius
          : (r.avg_temperature_celsius ?? 0),
      device_id: r.device_id ?? "PROBE",
    }));
    const mappedLive = liveReadings.map((r) => ({
      recorded_at: r.recorded_at,
      temperature_celsius: r.temperature_celsius,
      device_id: r.device_id,
    }));
    return [...mappedBase, ...mappedLive].slice(-40);
  }, [baseReadings, liveReadings]);

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (detailQuery.error || !shipment) {
    const problem = isApiError(detailQuery.error)
      ? detailQuery.error.problem
      : null;
    return (
      <div className="space-y-4">
        <Link
          href="/shipments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="size-3.5" />
          {t("backToList")}
        </Link>
        <ProblemBanner problem={problem} />
      </div>
    );
  }

  const events = eventsQuery.data?.items ?? [];
  const incidents = incidentsQuery.data?.items ?? [];
  const openIncidentsCount = incidents.filter(
    (inc) => inc.ended_at === null,
  ).length;

  const year = new Date(shipment.created_at).getUTCFullYear() || 2026;
  const shortShipmentCode = `#SH-${year}-${shipment.sscc.slice(-6)}`;
  const distanceKm = computeHaversineKm(
    shipment.origin.latitude,
    shipment.origin.longitude,
    shipment.destination.latitude,
    shipment.destination.longitude,
  );

  const ownerParticipant = shipment.participants.find(
    (p) => p.role === "OWNER",
  );
  const carrierParticipant =
    shipment.participants.find((p) => p.role === "CARRIER") ?? ownerParticipant;
  const consigneeParticipant = shipment.participants.find(
    (p) => p.role === "CONSIGNEE",
  );

  const activeDrivers = driversQuery.data?.items ?? [];
  const selectedDriverObj = activeDrivers.find(
    (d) => d.id === (selectedDriverId || shipment.assigned_driver_id),
  );
  const assignedDriverObj = activeDrivers.find(
    (d) => d.id === shipment.assigned_driver_id,
  );

  const minTemp = shipment.product.min_temp_celsius;
  const maxTemp = shipment.product.max_temp_celsius;
  const latestReading =
    combinedReadings.length > 0
      ? combinedReadings[combinedReadings.length - 1]
      : null;
  const currentTemp = latestReading
    ? Number(latestReading.temperature_celsius.toFixed(1))
    : null;
  const isTempSafe =
    currentTemp === null || (currentTemp >= minTemp && currentTemp <= maxTemp);

  const countdownMinutes = Math.floor(countdownSeconds / 60);
  const countdownRemainder = countdownSeconds % 60;
  const formattedCountdown = `${String(countdownMinutes).padStart(2, "0")}:${String(countdownRemainder).padStart(2, "0")}`;

  const codeDigits = issuedPickupCode
    ? issuedPickupCode.code.padEnd(6, "•").slice(0, 6).split("")
    : ["•", "•", "•", "•", "•", "•"];

  const pickupEvent = events.find(
    (e) => e.event_type === "shipment.pickup_confirmed",
  );
  const pickupPosition = (
    pickupEvent?.data as {
      position?: {
        latitude?: number;
        longitude?: number;
        accuracy_meters?: number;
      };
    } | null
  )?.position;

  const step2Completed =
    Boolean(shipment.assigned_driver_id) || shipment.status !== "CREATED";
  const step3Completed =
    Boolean(shipment.picked_up_at) ||
    shipment.status === "IN_TRANSIT" ||
    shipment.status === "DELIVERED";

  return (
    <section className="space-y-5 pb-10">
      {/* Top Breadcrumb & Step-Specific Action Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
            <Link href="/shipments" className="hover:text-slate-700">
              Vận chuyển &amp; Điều phối
            </Link>
            <span>›</span>
            <span className="font-mono font-bold text-slate-700">
              {shortShipmentCode}
            </span>
            <span>›</span>
            <span className="font-bold text-[#2563EB]">
              {activeStep === "2" && "Điều phối đối tác & Tài xế"}
              {activeStep === "3" && "Bàn giao Dock & Pickup Code"}
              {activeStep === "4" && "Hành trình & Hash Chain"}
            </span>
          </div>
          {activeStep === "3" && (
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Bàn Giao Cửa Xuất Dock &amp; Cấp Mã Pickup Code
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {printLabelPerm.allowed && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700"
            >
              <Link href={`/shipments/${shipment.id}/label`}>
                <Printer className="size-3.5" />
                <span>In Phiếu Dock</span>
              </Link>
            </Button>
          )}
          {activeStep === "3" && issuePickupPerm.allowed && (
            <Button
              type="button"
              size="sm"
              onClick={() => void handleIssuePickupCode()}
              disabled={issuePickupMutation.isPending}
              className="h-9 rounded-xl bg-[#0F172A] px-4 text-xs font-bold text-white hover:bg-[#1E293B]"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Ủy Quyền Xuất Kho</span>
            </Button>
          )}
        </div>
      </header>

      {/* 4-Step Horizontal Stepper */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs sm:grid-cols-4">
        {/* Step 1: Lập vận đơn (Always Complete on detail page) */}
        <Link
          href="/shipments/new"
          className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 text-left transition hover:bg-blue-50/80"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white">
            <Check className="size-3.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-wider text-[#2563EB] uppercase">
              BƯỚC 1 · COMPLETE
            </div>
            <div className="truncate text-xs font-bold text-slate-900">
              Lập vận đơn
            </div>
          </div>
        </Link>

        {/* Step 2: Điều phối & Tài xế */}
        <button
          type="button"
          onClick={() => selectStep("2")}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition",
            activeStep === "2"
              ? "bg-[#0F172A] text-white shadow-xs"
              : step2Completed
                ? "border border-blue-100 bg-blue-50/40 hover:bg-blue-50/80"
                : "border border-slate-100 bg-slate-50/60 hover:bg-slate-100",
          )}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
              activeStep === "2"
                ? "bg-[#2563EB] text-white"
                : step2Completed
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-200 text-slate-600",
            )}
          >
            {step2Completed && activeStep !== "2" ? (
              <Check className="size-3.5" />
            ) : (
              "2"
            )}
          </span>
          <div className="min-w-0">
            <div
              className={cn(
                "text-[10px] font-bold tracking-wider uppercase",
                activeStep === "2"
                  ? "text-blue-400"
                  : step2Completed
                    ? "text-[#2563EB]"
                    : "text-slate-400",
              )}
            >
              {activeStep === "2"
                ? "BƯỚC 2 · ĐANG THỰC HIỆN"
                : step2Completed
                  ? "BƯỚC 2 · COMPLETE"
                  : "BƯỚC 2"}
            </div>
            <div
              className={cn(
                "truncate text-xs font-bold",
                activeStep === "2" ? "text-white" : "text-slate-900",
              )}
            >
              Điều phối &amp; Tài xế
            </div>
          </div>
        </button>

        {/* Step 3: Xuất kho & Pickup Dock */}
        <button
          type="button"
          onClick={() => selectStep("3")}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition",
            activeStep === "3"
              ? "bg-[#0F172A] text-white shadow-xs"
              : step3Completed
                ? "border border-blue-100 bg-blue-50/40 hover:bg-blue-50/80"
                : "border border-slate-100 bg-slate-50/60 hover:bg-slate-100",
          )}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
              activeStep === "3"
                ? "bg-[#2563EB] text-white"
                : step3Completed
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-200 text-slate-600",
            )}
          >
            {step3Completed && activeStep !== "3" ? (
              <Check className="size-3.5" />
            ) : (
              "3"
            )}
          </span>
          <div className="min-w-0">
            <div
              className={cn(
                "text-[10px] font-bold tracking-wider uppercase",
                activeStep === "3"
                  ? "text-blue-400"
                  : step3Completed
                    ? "text-[#2563EB]"
                    : "text-slate-400",
              )}
            >
              {activeStep === "3"
                ? "BƯỚC 3 · ĐANG THỰC HIỆN"
                : step3Completed
                  ? "BƯỚC 3 · COMPLETE"
                  : "BƯỚC 3"}
            </div>
            <div
              className={cn(
                "truncate text-xs font-bold",
                activeStep === "3" ? "text-white" : "text-slate-900",
              )}
            >
              Xuất kho &amp; Pickup Dock
            </div>
          </div>
        </button>

        {/* Step 4: Vận chuyển & ePOD */}
        <button
          type="button"
          onClick={() => selectStep("4")}
          className={cn(
            "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition",
            activeStep === "4"
              ? "bg-[#0F172A] text-white shadow-xs"
              : shipment.status === "DELIVERED"
                ? "border border-blue-100 bg-blue-50/40 hover:bg-blue-50/80"
                : "border border-slate-100 bg-slate-50/60 hover:bg-slate-100",
          )}
        >
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
              activeStep === "4"
                ? "bg-[#2563EB] text-white"
                : shipment.status === "DELIVERED"
                  ? "bg-[#2563EB] text-white"
                  : "bg-slate-200 text-slate-600",
            )}
          >
            {shipment.status === "DELIVERED" && activeStep !== "4" ? (
              <Check className="size-3.5" />
            ) : (
              "4"
            )}
          </span>
          <div className="min-w-0">
            <div
              className={cn(
                "text-[10px] font-bold tracking-wider uppercase",
                activeStep === "4"
                  ? "text-blue-400"
                  : shipment.status === "DELIVERED"
                    ? "text-[#2563EB]"
                    : "text-slate-400",
              )}
            >
              {activeStep === "4"
                ? "BƯỚC 4 · ĐANG THỰC HIỆN"
                : shipment.status === "DELIVERED"
                  ? "BƯỚC 4 · COMPLETE"
                  : "BƯỚC 4"}
            </div>
            <div
              className={cn(
                "truncate text-xs font-bold",
                activeStep === "4" ? "text-white" : "text-slate-900",
              )}
            >
              Vận chuyển &amp; ePOD
            </div>
          </div>
        </button>
      </div>

      <ProblemBanner problem={actionProblem} />

      {/* ===================================================================== */}
      {/* STEP 2: ĐIỀU PHỐI ĐỐI TÁC & GÁN TÀI XẾ                               */}
      {/* ===================================================================== */}
      {activeStep === "2" && (
        <div className="space-y-5">
          {/* Shipment Summary Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Vận đơn {shortShipmentCode}
                </h2>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-0.5 text-[11px] font-bold text-[#2563EB]">
                  <span className="size-1.5 rounded-full bg-[#2563EB]" />
                  <span>
                    {shipment.status === "CREATED" &&
                      !shipment.assigned_driver_id
                      ? "CREATED (KHỞI TẠO, CHỜ ĐIỀU PHỐI)"
                      : shipment.status === "CREATED" &&
                        shipment.assigned_driver_id
                        ? "ASSIGNED (ĐÃ GÁN TÀI XẾ)"
                        : `${shipment.status} (${tStatus(shipment.status)})`}
                  </span>
                </span>
              </div>

              <div className="inline-block rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">
                SSCC: {shipment.sscc}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>
                  Lô hàng:{" "}
                  <strong className="font-mono text-slate-900">
                    {shipment.lot.lot_number}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Sản phẩm:{" "}
                  <strong className="text-slate-900">
                    {shipment.product.name}
                  </strong>{" "}
                  ({formatQuantity(shipment.quantity, locale)} thùng)
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2563EB]">
                <Thermometer className="size-3.5" />
                <span>
                  Yêu cầu bảo quản: {formatTemperature(minTemp)} –{" "}
                  {formatTemperature(maxTemp)}
                </span>
              </div>
            </div>

            <div className="min-w-72 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500">Điểm nhận: </span>
                  <strong className="text-slate-900">
                    {shipment.origin.name}
                  </strong>
                  <div className="font-mono text-[11px] text-[#2563EB]">
                    GLN: {shipment.origin.gln}
                  </div>
                </div>
                <div className="border-t border-slate-200/70 pt-2">
                  <span className="text-slate-500">Điểm giao: </span>
                  <strong className="text-slate-900">
                    {shipment.destination.name}
                  </strong>
                  <div className="font-mono text-[11px] text-[#2563EB]">
                    GLN: {shipment.destination.gln}
                  </div>
                </div>
                <div className="border-t border-slate-200/70 pt-1.5 font-mono text-[11px] font-bold text-slate-500">
                  Khoảng cách: {distanceKm} KM
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Carrier & Driver Assignment */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left Card: 1. Điều Phối Hãng Vận Tải (Carrier) */}
            <form
              onSubmit={handleAssignCarrier}
              className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 border-b border-slate-100 pb-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                    <Truck className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      1. Điều Phối Hãng Vận Tải (Carrier)
                    </h3>
                    <p className="text-xs font-medium text-slate-400">
                      Ủy thác trách nhiệm chuỗi cung ứng cho đơn vị vận chuyển
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    PHƯƠNG THỨC VẬN CHUYỂN
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCarrierMode("EXTERNAL")}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3 text-left transition",
                        carrierMode === "EXTERNAL" ||
                          hasExternalCarrier(shipment)
                          ? "border-[#2563EB] bg-blue-50/40"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">
                          Thuê 3PL Đối Tác
                        </span>
                        <span
                          className={cn(
                            "size-3.5 rounded-full border",
                            carrierMode === "EXTERNAL"
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-slate-300",
                          )}
                        />
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Tenant Directory 3PL ủy thác
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCarrierMode("IN_HOUSE")}
                      disabled={hasExternalCarrier(shipment)}
                      className={cn(
                        "cursor-pointer rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                        carrierMode === "IN_HOUSE" &&
                          !hasExternalCarrier(shipment)
                          ? "border-[#2563EB] bg-blue-50/40"
                          : "border-slate-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-900">
                          Đội Xe Nội Bộ
                        </span>
                        <span
                          className={cn(
                            "size-3.5 rounded-full border",
                            carrierMode === "IN_HOUSE" &&
                              !hasExternalCarrier(shipment)
                              ? "border-[#2563EB] bg-[#2563EB]"
                              : "border-slate-300",
                          )}
                        />
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        Hạm đội xe {ownerParticipant?.tenant_code ?? "OWNER"}
                      </div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={carrierInputId}
                    className="text-xs font-bold text-slate-700"
                  >
                    Mã Tenant Directory Đối Tác
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
                      <Input
                        id={carrierInputId}
                        value={carrierCodeInput}
                        onChange={(e) => {
                          setCarrierCodeInput(e.target.value.toUpperCase());
                          setResolvedCarrierTenant(null);
                        }}
                        disabled={!assignCarrierPerm.allowed}
                        placeholder={
                          carrierParticipant?.tenant_code ?? "MEKONG_LOGISTICS"
                        }
                        className="h-10 rounded-xl pl-9 font-mono text-xs font-bold uppercase"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleLookupCarrierTenant()}
                      disabled={
                        !carrierCodeInput.trim() || !assignCarrierPerm.allowed
                      }
                      className="h-10 rounded-xl bg-[#0F172A] px-4 text-xs font-bold text-white hover:bg-[#1E293B]"
                    >
                      Tra Cứu
                    </Button>
                  </div>
                </div>

                {/* Resolved or Current Carrier Info Box */}
                {(resolvedCarrierTenant || carrierParticipant) && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2563EB] shadow-2xs">
                          <Truck className="size-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-900">
                              {resolvedCarrierTenant?.legal_name ??
                                carrierParticipant?.legal_name}
                            </span>
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                              ACTIVE
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] font-semibold text-slate-500">
                            Mã:{" "}
                            {resolvedCarrierTenant?.code ??
                              carrierParticipant?.tenant_code}
                          </div>
                        </div>
                      </div>
                      <CheckCircle2 className="size-4.5 text-[#2563EB]" />
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={
                  !assignCarrierPerm.allowed ||
                  !carrierCodeInput.trim() ||
                  assignCarrierMutation.isPending
                }
                className="h-10 w-full rounded-xl bg-[#0F172A] text-xs font-bold text-white hover:bg-[#1E293B]"
              >
                <CheckCircle2 className="size-4" />
                <span>Xác nhận &amp; Ủy thác Hãng vận tải</span>
              </Button>
            </form>

            {/* Right Card: 2. Phân Bổ & Gán Tài Xế (Driver) */}
            <form
              onSubmit={handleAssignDriver}
              className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3 border-b border-slate-100 pb-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                    <UserCheck className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      2. Phân Bổ &amp; Gán Tài Xế (Driver)
                    </h3>
                    <p className="text-xs font-medium text-slate-400">
                      Chỉ định nhân sự vận hành phương tiện và tiếp nhận cảm
                      biến
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-xs">
                  <div>
                    <span className="text-slate-500">Đơn vị chủ quản: </span>
                    <strong className="font-mono text-slate-900">
                      {carrierParticipant?.tenant_code ?? "—"}
                    </strong>
                  </div>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                    {activeDrivers.length} TÀI XẾ KHẢ DỤNG
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor={driverSelectId}
                    className="text-xs font-bold text-slate-700"
                  >
                    Lựa chọn Tài Xế Phụ Trách
                  </label>
                  <Select
                    value={selectedDriverId}
                    onValueChange={setSelectedDriverId}
                    disabled={!assignDriverPerm.allowed}
                  >
                    <SelectTrigger
                      id={driverSelectId}
                      className="h-10 w-full rounded-xl text-xs font-semibold"
                    >
                      <SelectValue
                        placeholder={
                          shipment.assigned_driver_id
                            ? `Đã gán tài xế (${shipment.assigned_driver_id.slice(0, 8)}...)`
                            : t("selectDriverPlaceholder")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {activeDrivers.map((driver) => (
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

                {/* Selected Driver Real Details Card */}
                {(selectedDriverObj || shipment.assigned_driver_id) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] font-mono text-xs font-bold text-white">
                        {selectedDriverObj
                          ? selectedDriverObj.full_name
                            .split(" ")
                            .slice(-2)
                            .map((w) => w[0]?.toUpperCase() ?? "")
                            .join("")
                          : "DR"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-xs font-extrabold text-slate-900">
                            {selectedDriverObj?.full_name ??
                              "Tài xế đã phân công"}
                          </span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                            {selectedDriverObj?.is_active !== false
                              ? "ACTIVE"
                              : "INACTIVE"}
                          </span>
                        </div>
                        {selectedDriverObj ? (
                          <div className="mt-1 space-y-0.5 text-[11px] font-medium text-slate-500">
                            <div>Email: {selectedDriverObj.email}</div>
                            <div>
                              SĐT: {selectedDriverObj.phone ?? "Chưa cập nhật"}{" "}
                              • Vai trò: {selectedDriverObj.role}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1 font-mono text-[11px] text-slate-500">
                            User ID: {shipment.assigned_driver_id}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-200/70 pt-2.5 text-[11px] text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-700 uppercase">
                          YÊU CẦU DẢI NHIỆT BẢO QUẢN LÔ HÀNG
                        </span>
                        <span className="font-mono font-bold text-[#2563EB]">
                          {formatTemperature(minTemp)} –{" "}
                          {formatTemperature(maxTemp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={
                  !assignDriverPerm.allowed ||
                  !selectedDriverId ||
                  assignDriverMutation.isPending
                }
                className="h-10 w-full rounded-xl bg-[#2563EB] text-xs font-bold text-white hover:bg-[#1D4ED8]"
              >
                <UserCheck className="size-4" />
                <span>Gán Tài Xế cho Vận Đơn</span>
              </Button>
            </form>
          </div>

          {/* Bottom Table: Bảng Đối Tác Tham Gia Vận Đơn (Shipment Participants) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Bảng Đối Tác Tham Gia Vận Đơn (Shipment Participants)
                </h3>
                <p className="text-xs font-medium text-slate-400">
                  Danh sách pháp nhân và nhân sự có thẩm quyền trong chuỗi ủy
                  thác vận tải EPCIS 2.0
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void detailQuery.refetch();
                  void eventsQuery.refetch();
                }}
                className="h-8 rounded-lg border-slate-200 text-xs font-bold"
              >
                <RefreshCw className="size-3.5" />
                <span>Làm mới</span>
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  <TableHead className="pl-6">VAI TRÒ</TableHead>
                  <TableHead>TÊN CÔNG TY</TableHead>
                  <TableHead>MÃ TENANT</TableHead>
                  <TableHead>ĐỊA ĐIỂM / NHÂN SỰ</TableHead>
                  <TableHead>THỜI ĐIỂM THAM GIA</TableHead>
                  <TableHead className="pr-6">TRẠNG THÁI ỦY NHIỆM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipment.participants.map((p) => {
                  const joinEvent =
                    p.role === "CARRIER"
                      ? events.find(
                        (e) => e.event_type === "shipment.participant_added",
                      )
                      : events[0];
                  const joinedAt = joinEvent?.occurred_at ?? shipment.created_at;

                  return (
                    <TableRow
                      key={`${p.tenant_id}:${p.role}`}
                      className="border-b border-slate-100"
                    >
                      <TableCell className="py-3.5 pl-6">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-[10px] font-bold",
                            p.role === "CARRIER"
                              ? "bg-[#2563EB] text-white"
                              : "bg-blue-50 text-[#2563EB]",
                          )}
                        >
                          <span className="size-1.5 rounded-full bg-current" />
                          <span>{p.role}</span>
                        </span>
                      </TableCell>

                      <TableCell className="py-3.5">
                        <div className="text-xs font-bold text-slate-900">
                          {p.legal_name}
                        </div>
                        {p.role === "OWNER" && (
                          <div className="font-mono text-[11px] text-slate-400">
                            GLN: {shipment.origin.gln}
                          </div>
                        )}
                        {p.role === "CONSIGNEE" && (
                          <div className="font-mono text-[11px] text-slate-400">
                            GLN: {shipment.destination.gln}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-xs font-bold text-slate-700">
                        {p.tenant_code}
                      </TableCell>

                      <TableCell className="py-3.5 text-xs">
                        {p.role === "OWNER" && (
                          <div>
                            <div className="font-bold text-slate-800">
                              {shipment.origin.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Kho xuất phát
                            </div>
                          </div>
                        )}
                        {p.role === "CARRIER" && (
                          <div>
                            <div className="font-bold text-slate-800">
                              {assignedDriverObj
                                ? `${assignedDriverObj.full_name} (Tài xế)`
                                : shipment.assigned_driver_id
                                  ? `Driver ID: ${shipment.assigned_driver_id.slice(0, 8)}...`
                                  : "Chưa gán tài xế"}
                            </div>
                            {assignedDriverObj && (
                              <div className="text-[11px] text-slate-400">
                                {assignedDriverObj.phone ??
                                  assignedDriverObj.email}
                              </div>
                            )}
                          </div>
                        )}
                        {p.role === "CONSIGNEE" && (
                          <div>
                            <div className="font-bold text-slate-800">
                              {shipment.destination.name}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Kho nhận hàng
                            </div>
                          </div>
                        )}
                        {p.role === "INSPECTOR" && (
                          <div className="font-bold text-slate-800">
                            Đơn vị kiểm toán độc lập
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 font-mono text-xs text-slate-500">
                        {formatDateTime(joinedAt, locale).display}
                      </TableCell>

                      <TableCell className="py-3.5 pr-6">
                        <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                          {p.role === "OWNER"
                            ? "ORIGIN_ISSUER"
                            : p.role === "CARRIER"
                              ? "DELEGATED_ACTIVE"
                              : p.role === "CONSIGNEE"
                                ? "AWAITING_RECEIVAL"
                                : "AUDITOR"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Step 2 Bottom Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-6 py-4 shadow-xs">
            <div>
              {cancelPerm.allowed && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openDialog("cancel")}
                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <XCircle className="size-4" />
                  <span>Hủy Vận Đơn</span>
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-700"
              >
                <Link href="/shipments">← Quay lại Danh sách</Link>
              </Button>
              <Button
                type="button"
                onClick={() => selectStep("3")}
                className="h-10 gap-2 rounded-xl bg-[#0F172A] px-5 text-xs font-bold text-white hover:bg-[#1E293B]"
              >
                <span>Cấp mã lấy hàng tại Dock</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: BÀN GIAO CỬA XUẤT DOCK & CẤP MÃ PICKUP CODE                   */}
      {/* ===================================================================== */}
      {activeStep === "3" && (
        <div className="space-y-5">
          {/* Dark Navy 3-Column Summary Banner */}
          <div className="grid grid-cols-1 gap-4 rounded-2xl bg-[#0F172A] p-5 text-white shadow-sm lg:grid-cols-3">
            <div className="space-y-1.5 border-b border-slate-800 pb-4 lg:border-r lg:border-b-0 lg:pr-4 lg:pb-0">
              <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                SSCC PALLET LÔ HÀNG LẠNH
              </div>
              <div className="font-mono text-base font-extrabold tracking-wide text-white">
                (00) {formatSscc(shipment.sscc)}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <QrCode className="size-3.5 text-blue-400" />
                <span>
                  Batch: {shipment.lot.lot_number} •{" "}
                  {formatQuantity(shipment.quantity, locale)} thùng{" "}
                  {shipment.product.name}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-b border-slate-800 pb-4 lg:border-r lg:border-b-0 lg:px-2 lg:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  ĐIỂM TẬP KẾT XUẤT HÀNG
                </span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                  • SẴN SÀNG
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <MapPin className="size-4 text-blue-400" />
                <span>{shipment.origin.name}</span>
              </div>
              <div className="font-mono text-xs text-slate-400">
                (GLN {shipment.origin.gln} · Bán kính{" "}
                {shipment.origin.geo_fence_radius_meters}m)
              </div>
            </div>

            <div className="space-y-1.5 lg:pl-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  PHƯƠNG TIỆN &amp; TÀI XẾ TIẾP NHẬN
                </span>
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                  {shipment.assigned_driver_id ? "Đã định danh" : "Chưa gán"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <Truck className="size-4 text-blue-400" />
                <span>
                  {assignedDriverObj?.full_name ??
                    (shipment.assigned_driver_id
                      ? `Driver ID: ${shipment.assigned_driver_id.slice(0, 8)}...`
                      : "Chưa phân công tài xế")}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                {carrierParticipant?.legal_name} (
                {carrierParticipant?.tenant_code})
                {assignedDriverObj?.phone
                  ? ` • SĐT: ${assignedDriverObj.phone}`
                  : ""}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column (7 cols): Pickup Code Generator & Driver Telemetry Log */}
            <div className="space-y-5 lg:col-span-7">
              {/* Card 1: TRÌNH TẠO & HIỂN THỊ MÃ LẤY HÀNG */}
              <div className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold tracking-wider text-slate-800 uppercase">
                  <span className="size-2.5 rounded-full bg-[#2563EB]" />
                  <span>TRÌNH TẠO &amp; HIỂN THỊ MÃ LẤY HÀNG</span>
                </div>

                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-6 text-center">
                  <div className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                    MÃ XÁC NHẬN BÀN GIAO CỬA DOCK (OTP 6 CHỮ SỐ)
                  </div>

                  {/* 6 OTP Digit Boxes */}
                  <div className="my-5 flex justify-center gap-2.5 sm:gap-3">
                    {codeDigits.map((digit, index) => (
                      <span
                        // biome-ignore lint/suspicious/noArrayIndexKey: Fixed 6-digit display slots
                        key={index}
                        className="flex h-14 w-11 items-center justify-center rounded-xl border border-blue-200 bg-white font-mono text-2xl font-extrabold text-[#0F172A] shadow-2xs sm:h-16 sm:w-13"
                      >
                        {digit}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!issuedPickupCode}
                      onClick={() => {
                        if (issuedPickupCode) {
                          copyValue("otp", issuedPickupCode.code);
                        }
                      }}
                      className="h-9 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700"
                    >
                      {copiedKey === "otp" ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      <span>
                        {copiedKey === "otp" ? "Đã sao chép" : "Sao chép mã"}
                      </span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void detailQuery.refetch();
                        void eventsQuery.refetch();
                      }}
                      className="h-9 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700"
                    >
                      <RefreshCw className="size-3.5" />
                      <span>Làm mới màn hình</span>
                    </Button>
                  </div>

                  {/* Validity & Attempts Boxes */}
                  <div className="mt-5 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <Clock className="size-5 shrink-0 text-[#2563EB]" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          THỜI GIAN HIỆU LỰC
                        </div>
                        <div className="font-mono text-base font-extrabold text-slate-900">
                          {issuedPickupCode ? formattedCountdown : "15:00"}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                          {issuedPickupCode
                            ? `Hết hạn: ${formatDateTime(issuedPickupCode.expires_at, locale).display}`
                            : "Có hiệu lực 15 phút sau khi cấp"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5">
                      <ShieldCheck className="size-5 shrink-0 text-[#2563EB]" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          SỐ LẦN THỬ CHO PHÉP
                        </div>
                        <div className="font-mono text-base font-extrabold text-slate-900">
                          {issuedPickupCode?.attempts_allowed ?? 5} / 5 lượt
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                          Tự động khóa sau 5 lần nhập sai
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Rule Notice */}
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 text-xs leading-relaxed text-slate-600">
                  <div className="font-bold text-slate-900">
                    ⓘ Quy trình bảo mật xuất kho theo tiêu chuẩn GS1 &amp;
                    EPCIS:
                  </div>
                  <p className="mt-1">
                    Mã 6 chữ số này chỉ hiển thị một lần duy nhất tại bảng điều
                    khiển này và được mã hóa bảo mật{" "}
                    <code className="font-mono font-bold">HMAC-SHA256</code>{" "}
                    trên máy chủ phân quyền. Thủ kho đọc hoặc giao tiếp đối soát
                    trực tiếp cho tài xế tại cửa xuất kho. Mã sẽ tự động bị hủy
                    vô hiệu hóa ngay lập tức nếu gán đổi tài xế, hủy vận đơn
                    hoặc quá hạn 15 phút.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="text-xs font-medium text-slate-500">
                    Người thao tác:{" "}
                    <strong className="text-slate-900">
                      {user?.full_name} ({user?.role})
                    </strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => void handleIssuePickupCode()}
                      disabled={
                        !issuePickupPerm.allowed ||
                        issuePickupMutation.isPending
                      }
                      className="h-10 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white hover:bg-rose-800"
                    >
                      <KeyRound className="size-3.5" />
                      <span>
                        {issuedPickupCode
                          ? "Cấp lại mã mới"
                          : "Cấp mã Pickup Code"}
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => selectStep("4")}
                      className="h-10 gap-1.5 rounded-xl border-slate-200 text-xs font-bold"
                    >
                      <span>Sang Bước 4</span>
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Card 2: Nhật Ký Tương Tác Tài Xế (Driver PWA Telemetry) */}
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                  <Radio className="size-4 text-[#2563EB]" />
                  <span>Nhật Ký Tương Tác Tài Xế (Driver PWA Telemetry)</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      1. QUÉT PALLET SSCC
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-xs font-extrabold",
                        shipment.picked_up_at
                          ? "text-[#2563EB]"
                          : "text-slate-700",
                      )}
                    >
                      {shipment.picked_up_at
                        ? "✓ Đã quét khớp"
                        : "Chờ tài xế quét"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      2. NHẬP TOKEN DOCK
                    </div>
                    <div
                      className={cn(
                        "mt-1 font-mono text-xs font-extrabold",
                        shipment.picked_up_at
                          ? "text-emerald-600"
                          : "text-slate-700",
                      )}
                    >
                      {shipment.picked_up_at
                        ? "✓ Đã xác thực OTP"
                        : issuedPickupCode
                          ? `Chờ nhập [${issuedPickupCode.code}]`
                          : "Chờ cấp mã"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-center">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      3. TỌA ĐỘ GPS (WGS-84)
                    </div>
                    <div className="mt-1 font-mono text-[11px] font-bold text-slate-800">
                      {pickupPosition?.latitude !== undefined &&
                        pickupPosition?.longitude !== undefined
                        ? `${pickupPosition.latitude}, ${pickupPosition.longitude}`
                        : `${shipment.origin.latitude}, ${shipment.origin.longitude}`}
                    </div>
                  </div>
                </div>

                {/* Real Event Log Console */}
                <div className="space-y-1.5 rounded-xl bg-[#0F172A] p-4 font-mono text-[11px] leading-relaxed text-slate-300">
                  {events.map((evt) => (
                    <div key={evt.event_id}>
                      <span className="text-slate-500">
                        [{evt.occurred_at.slice(11, 19)} UTC]
                      </span>{" "}
                      <span className="font-bold text-blue-400">
                        {evt.event_type}
                      </span>
                      : seq #{evt.sequence} · status={evt.subject.status} ·
                      hash={evt.event_hash.slice(0, 12)}...
                    </div>
                  ))}
                  {issuedPickupCode && (
                    <div className="text-emerald-400">
                      [{new Date().toISOString().slice(11, 19)} UTC] HTTP POST
                      /api/v1/shipments/{shipment.id.slice(0, 8)}.../pickup-code
                      issued. HMAC hash saved (expires{" "}
                      {issuedPickupCode.expires_at.slice(11, 19)} UTC).
                    </div>
                  )}
                  {!shipment.picked_up_at && (
                    <div className="text-amber-300">
                      [WAITING] Driver PWA confirmation at {shipment.origin.name}{" "}
                      (GLN {shipment.origin.gln})...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Phiếu Bàn Giao Cửa Dock Xuất */}
            <aside className="space-y-5 lg:col-span-5">
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                    <FileText className="size-4 text-[#2563EB]" />
                    <span>Phiếu Bàn Giao Cửa Dock Xuất</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-slate-400">
                    SSCC-{shipment.sscc.slice(-6)}
                  </span>
                </div>

                <div className="mt-4 flex items-start justify-between gap-3 border-b border-dashed border-slate-200 pb-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase">
                      PHIẾU XUẤT KHO LẠNH DOCK
                    </h3>
                    <div className="text-[11px] font-medium text-slate-400">
                      Cold Chain Handover Release Voucher
                    </div>
                    <div className="mt-1 text-xs font-bold text-[#2563EB]">
                      Đơn vị: {ownerParticipant?.legal_name}
                    </div>
                  </div>
                  <div className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-2">
                    <canvas
                      ref={barcodeCanvasRef}
                      className="h-10 max-w-28"
                      aria-label={`GS1-128 ${shipment.sscc}`}
                    />
                    <span className="mt-1 font-mono text-[9px] font-bold text-slate-400">
                      SCAN VERIFY
                    </span>
                  </div>
                </div>

                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Số vận đơn:</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {shortShipmentCode}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Cơ sở xuất hàng:</dt>
                    <dd className="font-bold text-slate-900">
                      {shipment.origin.name}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Đơn vị vận tải:</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {carrierParticipant?.tenant_code}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Giờ khởi tạo:</dt>
                    <dd className="font-mono font-bold text-slate-900">
                      {formatDateTime(shipment.created_at, locale).display}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 space-y-2.5 border-t border-slate-100 pt-4">
                  <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    BẢNG KIỂM TRA ĐIỀU KIỆN NGHIỆM THU XUẤT DOCK:
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Snowflake className="size-4 text-[#2563EB]" />
                      <div>
                        <div className="font-bold text-slate-900">
                          Nhiệt độ bảo quản:{" "}
                          {currentTemp !== null
                            ? formatTemperature(currentTemp)
                            : `${formatTemperature(minTemp)} – ${formatTemperature(maxTemp)}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Tiêu chuẩn yêu cầu: {formatTemperature(minTemp)} đến{" "}
                          {formatTemperature(maxTemp)}
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                      ĐẠT CHUẨN
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <LocateFixed className="size-4 text-[#2563EB]" />
                      <div>
                        <div className="font-bold text-slate-900">
                          Định vị Geo-fence: Vùng{" "}
                          {shipment.origin.geo_fence_radius_meters}m
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {shipment.origin.name} (GLN {shipment.origin.gln})
                        </div>
                      </div>
                    </div>
                    <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB]">
                      HỢP LỆ
                    </span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="mt-5 grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="rounded-xl border border-dashed border-slate-200 p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      THỦ KHO BÀN GIAO
                    </div>
                    <div className="mt-2 font-extrabold text-[#2563EB]">
                      {user?.full_name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {ownerParticipant?.tenant_code}
                    </div>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-200 p-3">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      TÀI XẾ TIẾP NHẬN
                    </div>
                    <div className="mt-2 font-extrabold text-[#2563EB]">
                      {assignedDriverObj?.full_name ??
                        carrierParticipant?.legal_name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      {carrierParticipant?.tenant_code}
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  className="mt-5 h-10 w-full rounded-xl bg-[#0F172A] text-xs font-bold text-white hover:bg-[#1E293B]"
                >
                  <Link href={`/shipments/${shipment.id}/label`}>
                    <Printer className="size-4" />
                    <span>In Phiếu Giao Nhận Dock</span>
                  </Link>
                </Button>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 4: HÀNH TRÌNH VẬN CHUYỂN & KIỂM ĐỊNH HASH CHAIN                   */}
      {/* ===================================================================== */}
      {activeStep === "4" && (
        <div className="space-y-5">
          {/* Shipment Header Card */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                  Vận Đơn {shortShipmentCode}
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold",
                    shipment.status === "IN_TRANSIT"
                      ? "border-blue-200 bg-blue-50 text-[#2563EB]"
                      : shipment.status === "DELIVERED"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : shipment.status === "RECALLED"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-100 text-slate-700",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  <span>
                    {shipment.status === "IN_TRANSIT"
                      ? "ĐANG TRÊN ĐƯỜNG GIAO"
                      : tStatus(shipment.status).toUpperCase()}
                  </span>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span>
                  SSCC-18:{" "}
                  <strong className="font-mono text-slate-900">
                    {shipment.sscc}
                  </strong>
                </span>
                <span>
                  Lô hàng:{" "}
                  <strong className="font-mono text-slate-900">
                    {shipment.lot.lot_number}
                  </strong>{" "}
                  ({formatQuantity(shipment.quantity, locale)}{" "}
                  {shipment.product.name})
                </span>
              </div>

              <div className="text-xs text-slate-600">
                Đơn vị vận chuyển:{" "}
                <strong className="text-slate-900">
                  {carrierParticipant?.legal_name} (
                  {carrierParticipant?.tenant_code})
                </strong>
                {assignedDriverObj
                  ? ` · Tài xế: ${assignedDriverObj.full_name}`
                  : ""}
              </div>
            </div>

            {/* Temperature Box */}
            <div className="flex items-center gap-3.5 rounded-2xl border border-blue-200/80 bg-blue-50/40 px-5 py-3.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100/80 text-[#2563EB]">
                <Thermometer className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  <span>NHIỆT ĐỘ THÙNG XE</span>
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      isTempSafe ? "bg-[#2563EB]" : "bg-rose-600",
                    )}
                  />
                </div>
                <div
                  className={cn(
                    "font-mono text-xl font-extrabold",
                    isTempSafe ? "text-[#2563EB]" : "text-rose-600",
                  )}
                >
                  {currentTemp !== null
                    ? formatTemperature(currentTemp)
                    : `${formatTemperature(minTemp)} ~ ${formatTemperature(maxTemp)}`}
                </div>
                <div className="text-[11px] font-medium text-slate-400">
                  (Chuẩn: {formatTemperature(minTemp)} ~{" "}
                  {formatTemperature(maxTemp)})
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column (7 cols): Nhật Ký Sự Kiện & Kiểm Định Hash Chain */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Link2 className="size-4 text-[#2563EB]" />
                  <span>Nhật Ký Sự Kiện (EPCIS 2.0 Hash Chain)</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleVerifyIntegrity()}
                  disabled={integrityMutation.isPending}
                  className="h-8 rounded-xl border-blue-200 bg-blue-50/60 text-xs font-bold text-[#2563EB] hover:bg-blue-100/70"
                >
                  <ShieldCheck className="size-3.5" />
                  <span>
                    {integrityMutation.isPending
                      ? "Đang kiểm định..."
                      : "Kiểm định Hash Chain"}
                  </span>
                </Button>
              </div>

              {/* Cryptographic Integrity Verification Result Banner */}
              {integrityResult && (
                <div
                  className={cn(
                    "rounded-2xl border p-4 text-xs",
                    integrityResult.valid
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-950"
                      : "border-rose-300 bg-rose-50 text-rose-950",
                  )}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-2">
                      <ShieldCheck
                        className={cn(
                          "size-4",
                          integrityResult.valid
                            ? "text-emerald-600"
                            : "text-rose-600",
                        )}
                      />
                      <span>
                        {integrityResult.valid
                          ? "Chuỗi băm SHA-256 hợp lệ (RFC 8785 Canonical JSON Verified)"
                          : `Phát hiện đứt gãy chuỗi băm tại sequence #${integrityResult.first_invalid_sequence}`}
                      </span>
                    </span>
                    <span className="font-mono">
                      {integrityResult.event_count} sự kiện
                    </span>
                  </div>
                  {integrityResult.head_hash && (
                    <div className="mt-1.5 truncate font-mono text-[11px] text-slate-600">
                      Head Hash: {integrityResult.head_hash}
                    </div>
                  )}
                </div>
              )}

              {/* Vertical Event Timeline Cards */}
              <div className="space-y-3">
                {events.map((evt: ShipmentEvent, idx: number) => {
                  const seqLabel = String(evt.sequence).padStart(2, "0");
                  const isHighlight = idx === events.length - 1;
                  const payload = evt.data as Record<string, unknown>;
                  const pos = payload?.position as
                    | {
                      latitude?: number;
                      longitude?: number;
                      accuracy_meters?: number;
                    }
                    | undefined;

                  return (
                    <div
                      key={evt.event_id}
                      className={cn(
                        "rounded-2xl border bg-white p-5 shadow-xs transition",
                        isHighlight
                          ? "border-[#2563EB] ring-1 ring-[#2563EB]/20"
                          : "border-slate-200/90",
                      )}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-extrabold",
                            isHighlight
                              ? "bg-[#2563EB] text-white"
                              : "bg-blue-50 text-[#2563EB]",
                          )}
                        >
                          {seqLabel}
                        </span>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900">
                              {getEventDisplayTitle(evt.event_type)}
                            </h3>
                            <span className="font-mono text-[11px] font-semibold text-slate-400">
                              {evt.occurred_at
                                .replace("T", " ")
                                .slice(0, 19)}{" "}
                              UTC
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed text-slate-600">
                            {evt.event_type === "shipment.created" &&
                              `Khởi tạo vận đơn cho lô ${shipment.lot.lot_number} (${shipment.product.name}). Xuất từ ${shipment.origin.name} (GLN ${shipment.origin.gln}) đến ${shipment.destination.name} (GLN ${shipment.destination.gln}).`}
                            {evt.event_type === "shipment.participant_added" &&
                              `Điều phối và ủy thác vận chuyển cho đối tác ${carrierParticipant?.legal_name ?? ""} (${carrierParticipant?.tenant_code ?? ""}).`}
                            {evt.event_type === "shipment.driver_assigned" &&
                              `Phân công tài xế phụ trách vận đơn (Driver ID: ${String(payload?.driver_user_id ?? shipment.assigned_driver_id ?? "—")}).`}
                            {evt.event_type === "shipment.pickup_confirmed" &&
                              `Tài xế đã quét mã SSCC và xác thực thành công mã OTP Pickup Dock tại ${shipment.origin.name}.`}
                            {evt.event_type ===
                              "shipment.checkpoint_recorded" &&
                              `Trạm kiểm soát trung gian quét xác nhận SSCC tại GLN ${String(payload?.gln ?? "—")}.`}
                            {evt.event_type === "shipment.delivery_confirmed" &&
                              `Đối tác nhận hàng (${consigneeParticipant?.legal_name ?? ""}) đã quét xác nhận SSCC tại kho đích ${shipment.destination.name} (GLN ${shipment.destination.gln}).`}
                            {evt.event_type === "shipment.cancelled" &&
                              `Vận đơn đã bị hủy. Lý do: ${String(payload?.reason ?? "—")}`}
                            {evt.event_type === "shipment.recalled" &&
                              `Lô hàng bị thu hồi khẩn cấp. Lý do: ${String(payload?.reason ?? "—")}`}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {evt.event_type === "shipment.created" && (
                              <>
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                  GLN {shipment.origin.gln}
                                </span>
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                  {formatQuantity(shipment.quantity, locale)}{" "}
                                  Thùng
                                </span>
                              </>
                            )}

                            {pos?.latitude !== undefined &&
                              pos?.longitude !== undefined && (
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                                  GPS: {pos.latitude}, {pos.longitude}
                                  {pos.accuracy_meters !== undefined
                                    ? ` (±${pos.accuracy_meters}m)`
                                    : ""}
                                </span>
                              )}

                            <button
                              type="button"
                              onClick={() =>
                                copyValue(evt.event_id, evt.event_hash)
                              }
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-blue-100 bg-blue-50/60 px-2 py-0.5 font-mono text-[10px] font-bold text-[#2563EB] hover:bg-blue-100/70"
                              title={`event_hash: ${evt.event_hash}\nprev_event_hash: ${evt.prev_event_hash}`}
                            >
                              <span>
                                SHA-256: {evt.event_hash.slice(0, 14)}...
                              </span>
                              {copiedKey === evt.event_id ? (
                                <Check className="size-3" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Pending Step at Destination when not yet DELIVERED / CANCELLED / RECALLED */}
                {(shipment.status === "CREATED" ||
                  shipment.status === "IN_TRANSIT") && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5">
                      <div className="flex items-start gap-3.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-500">
                          {String(events.length + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-bold text-slate-600">
                              Đối tác nhận được Đơn hàng
                            </h3>
                            <span className="text-[11px] font-semibold text-slate-400">
                              Đang chờ sự kiện tại đích
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Chờ Thủ kho {shipment.destination.name} (GLN{" "}
                            {shipment.destination.gln}) tiếp nhận, quét mã vạch
                            SSCC, kiểm định điều kiện cảm biến và xác nhận đóng
                            phiên vận đơn.
                          </p>

                          {confirmDeliveryPerm.allowed && (
                            <div className="pt-1">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openDialog("delivery")}
                                className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                <PackageCheck className="size-4" />
                                <span>Xác nhận Giao hàng (Confirm Delivery)</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Right Column (5 cols): Tuyến Đường Vận Chuyển & Biểu Đồ Nhiệt Độ */}
            <aside className="space-y-5 lg:col-span-5">
              {/* Card 1: Tuyến Đường Vận Chuyển */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Navigation className="size-4 text-[#2563EB]" />
                  <span>Tuyến Đường Vận Chuyển</span>
                </div>

                {/* Route Corridor Visual Map */}
                <div className="relative mt-3.5 h-52 overflow-hidden rounded-xl border border-slate-200 bg-[#E2E8F0]">
                  <svg
                    viewBox="0 0 400 200"
                    className="size-full"
                    aria-label="Route corridor map"
                  >
                    <defs>
                      <pattern
                        id="corridor-grid"
                        width="32"
                        height="32"
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d="M 32 0 L 0 0 0 32"
                          fill="none"
                          stroke="#CBD5E1"
                          strokeWidth="0.7"
                        />
                      </pattern>
                    </defs>
                    <rect width="400" height="200" fill="url(#corridor-grid)" />
                    {/* Route Curve */}
                    <path
                      d="M 60 140 Q 200 75 340 65"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="3.5"
                      strokeDasharray={
                        shipment.status === "DELIVERED" ? "none" : "6 4"
                      }
                    />
                    {/* Origin Node */}
                    <circle
                      cx="60"
                      cy="140"
                      r="7"
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth="3"
                    />
                    {/* Current Vehicle Node when IN_TRANSIT */}
                    {shipment.status === "IN_TRANSIT" && (
                      <g>
                        <circle
                          cx="210"
                          cy="95"
                          r="14"
                          fill="#2563EB"
                          fillOpacity="0.2"
                        />
                        <circle
                          cx="210"
                          cy="95"
                          r="6"
                          fill="#2563EB"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                        />
                      </g>
                    )}
                    {/* Destination Geofence & Node */}
                    <circle
                      cx="340"
                      cy="65"
                      r="20"
                      fill="#2563EB"
                      fillOpacity="0.12"
                      stroke="#2563EB"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx="340"
                      cy="65"
                      r="7"
                      fill={
                        shipment.status === "DELIVERED" ? "#10B981" : "#2563EB"
                      }
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                    />
                  </svg>

                  {/* Top Overlay Pills */}
                  <div className="absolute top-3 right-3 left-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-800 shadow-xs">
                      <span className="size-2 rounded-full bg-[#2563EB]" />
                      <span>
                        {shipment.origin.latitude.toFixed(4)},{" "}
                        {shipment.origin.longitude.toFixed(4)}
                      </span>
                    </span>
                    <span className="rounded-lg bg-white/95 px-2.5 py-1 font-mono text-[11px] font-bold text-[#2563EB] shadow-xs">
                      {tStatus(shipment.status)}
                    </span>
                  </div>
                </div>

                {/* Route Progress Bar */}
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">
                      {shipment.origin.name} (Điểm đi)
                    </span>
                    <span className="font-mono font-bold text-[#2563EB]">
                      {shipment.status === "DELIVERED"
                        ? "100% Đã giao"
                        : shipment.status === "IN_TRANSIT"
                          ? "100% Đã rời kho"
                          : "Chờ xuất kho"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>→ {shipment.destination.name} (Điểm đến)</span>
                    <span className="font-mono font-semibold">
                      Khoảng cách: {distanceKm} km
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Geo-fence Điểm Đích & Biểu Đồ Nhiệt Độ */}
              <div className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-slate-700">
                    <MapPin className="size-3.5 text-[#2563EB]" />
                    <span>
                      Geo-fence Điểm Đích ({shipment.destination.name})
                    </span>
                  </span>
                  <span className="font-mono font-bold text-[#2563EB]">
                    Bán kính {shipment.destination.geo_fence_radius_meters}m
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                      BIỂU ĐỒ NHIỆT ĐỘ LẠNH THÙNG XE
                    </span>
                    <div className="flex items-center gap-1.5">
                      {(["raw", "1m", "15m"] as const).map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() => setResolution(res)}
                          className={cn(
                            "cursor-pointer rounded px-1.5 py-0.5 font-mono text-[10px] font-bold",
                            resolution === res
                              ? "bg-[#0F172A] text-white"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {res}
                        </button>
                      ))}
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold",
                          openIncidentsCount === 0
                            ? "bg-blue-50 text-[#2563EB]"
                            : "bg-rose-50 text-rose-600",
                        )}
                      >
                        {openIncidentsCount === 0
                          ? "Ổn định"
                          : `${openIncidentsCount} Vi phạm`}
                      </span>
                    </div>
                  </div>

                  {/* SVG Temperature Line Chart */}
                  {combinedReadings.length === 0 ? (
                    <div className="my-4 rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400">
                      Chưa có bản ghi cảm biến nhiệt độ cho SSCC này.
                    </div>
                  ) : (
                    <>
                      <div className="my-3 h-24 w-full">
                        <svg
                          viewBox="0 0 320 80"
                          className="size-full overflow-visible"
                          aria-label="Cold chain temperature chart"
                        >
                          <line
                            x1="0"
                            y1="15"
                            x2="320"
                            y2="15"
                            stroke="#CBD5E1"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <line
                            x1="0"
                            y1="65"
                            x2="320"
                            y2="65"
                            stroke="#CBD5E1"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          {(() => {
                            const slice = combinedReadings.slice(-8);
                            const span = Math.max(1, maxTemp - minTemp);
                            const points = slice.map((r, idx) => {
                              const x =
                                slice.length === 1
                                  ? 160
                                  : (idx / (slice.length - 1)) * 300 + 10;
                              const ratio =
                                (r.temperature_celsius - minTemp) / span;
                              const y = Math.max(
                                8,
                                Math.min(72, 65 - ratio * 50),
                              );
                              return { x, y, temp: r.temperature_celsius };
                            });
                            const pathD = points
                              .map(
                                (p, idx) =>
                                  `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
                              )
                              .join(" ");
                            return (
                              <>
                                <path
                                  d={pathD}
                                  fill="none"
                                  stroke="#2563EB"
                                  strokeWidth="2.5"
                                />
                                {points.map((p, idx) => (
                                  <circle
                                    // biome-ignore lint/suspicious/noArrayIndexKey: Chart coordinate points
                                    key={idx}
                                    cx={p.x}
                                    cy={p.y}
                                    r="3.5"
                                    fill="#2563EB"
                                  />
                                ))}
                              </>
                            );
                          })()}
                        </svg>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] font-semibold text-slate-500">
                        {combinedReadings.slice(-4).map((r) => (
                          <span key={r.recorded_at}>
                            {r.recorded_at.slice(11, 16)} (
                            {r.temperature_celsius.toFixed(1)}°C)
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Emergency Recall / Cancel Button */}
                {(recallPerm.allowed || cancelPerm.allowed) && (
                  <Button
                    type="button"
                    onClick={() =>
                      openDialog(recallPerm.allowed ? "recall" : "cancel")
                    }
                    className="mt-2 h-11 w-full gap-2 rounded-xl bg-rose-700 text-xs font-extrabold text-white hover:bg-rose-800"
                  >
                    <AlertTriangle className="size-4" />
                    <span>Báo Cáo Thu Hồi / Hủy Chuyến Khẩn Cấp</span>
                  </Button>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DIALOGS: CONFIRM DELIVERY, CANCEL SHIPMENT, EMERGENCY RECALL LOT      */}
      {/* ===================================================================== */}

      {/* Confirm Delivery Sheet */}
      <Sheet
        open={activeDialog === "delivery"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("confirmDeliveryTitle")}</SheetTitle>
            <SheetDescription>
              {t("confirmDeliveryDescription")}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleConfirmDelivery} className="space-y-4 px-4">
            <ProblemBanner problem={actionProblem} />

            <div className="space-y-1.5">
              <label htmlFor={ssccInputId} className="text-xs font-bold">
                {t("scannedSsccLabel")} *
              </label>
              <Input
                id={ssccInputId}
                inputMode="numeric"
                value={deliverySsccInput}
                onChange={(e) =>
                  setDeliverySsccInput(
                    e.target.value.replace(/\D/g, "").slice(0, 18),
                  )
                }
                placeholder={shipment.sscc}
                className="font-mono"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">GPS Position</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={acquireGeolocation}
                  disabled={isAcquiringGps}
                >
                  <LocateFixed className="size-3.5" />
                  <span>
                    {isAcquiringGps
                      ? t("acquiringLocation")
                      : t("acquireLocation")}
                  </span>
                </Button>
              </div>
              {acquiredPosition && (
                <p className="font-mono text-emerald-700">
                  {t("locationAcquired", {
                    lat: acquiredPosition.latitude,
                    lon: acquiredPosition.longitude,
                    acc: acquiredPosition.accuracy_meters,
                  })}
                </p>
              )}
              {gpsError && (
                <p className="font-semibold text-rose-600">{gpsError}</p>
              )}
            </div>

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {tApp("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={confirmDeliveryMutation.isPending}
              >
                {confirmDeliveryMutation.isPending
                  ? tApp("saving")
                  : t("confirmDeliverySubmit")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Cancel Shipment Sheet */}
      <Sheet
        open={activeDialog === "cancel"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t("cancelShipmentTitle")}</SheetTitle>
            <SheetDescription>
              {t("cancelShipmentDescription")}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCancelShipment} className="space-y-4 px-4">
            <ProblemBanner problem={actionProblem} />
            <div className="space-y-1.5">
              <label htmlFor={cancelInputId} className="text-xs font-bold">
                {t("cancelReasonLabel")} *
              </label>
              <Input
                id={cancelInputId}
                value={cancelReasonInput}
                onChange={(e) => setCancelReasonInput(e.target.value)}
                placeholder={t("cancelReasonPlaceholder")}
              />
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {tApp("cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  cancelReasonInput.trim().length < 3 ||
                  cancelMutation.isPending
                }
              >
                {cancelMutation.isPending
                  ? tApp("saving")
                  : t("cancelShipmentSubmit")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Emergency Recall Lot Sheet */}
      <Sheet
        open={activeDialog === "recall"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-rose-700">
              <ShieldAlert className="size-5" />
              <span>Thu Hồi Khẩn Cấp Lô Hàng ({shipment.lot.lot_number})</span>
            </SheetTitle>
            <SheetDescription>
              Lệnh thu hồi khẩn cấp (`POST /api/v1/lots/&#123;lot_id&#125;/recall`)
              sẽ chuyển trạng thái lô hàng và toàn bộ các vận đơn liên quan sang
              RECALLED ngay lập tức.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleRecallLot} className="space-y-4 px-4">
            <ProblemBanner problem={actionProblem} />
            <div className="space-y-1.5">
              <label htmlFor={recallInputId} className="text-xs font-bold">
                Lý do thu hồi khẩn cấp *
              </label>
              <Input
                id={recallInputId}
                value={recallReasonInput}
                onChange={(e) => setRecallReasonInput(e.target.value)}
                placeholder="VD: Phát hiện vi phạm chuỗi lạnh nghiêm trọng / nhiễm khuẩn..."
              />
            </div>
            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                {tApp("cancel")}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={
                  recallReasonInput.trim().length < 3 ||
                  recallMutation.isPending
                }
              >
                {recallMutation.isPending
                  ? tApp("saving")
                  : "Xác nhận Thu hồi Khẩn cấp"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
