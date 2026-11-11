"use client";

import bwipjs from "bwip-js";
import { ArrowLeft, Printer } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useSession } from "@/components/app-shell";
import { ProblemBanner } from "@/components/problem-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { isApiError } from "@/lib/api/errors";
import { formatGtin14 } from "@/lib/gs1/check-digit";
import { formatGln } from "@/lib/gs1/gln";
import { formatSscc } from "@/lib/gs1/sscc";
import { formatQuantity, formatTemperature } from "@/utils/format";
import { useShipmentDetailQuery } from "../queries/queries";

export function ShipmentLabelView({ shipmentId }: { shipmentId: string }) {
  const { user } = useSession();
  const locale = useLocale();
  const t = useTranslations("shipments.label");
  const tDetail = useTranslations("shipments.detail");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const detailQuery = useShipmentDetailQuery(shipmentId, Boolean(user));
  const shipment = detailQuery.data;

  useEffect(() => {
    if (!shipment || !canvasRef.current) {
      return;
    }
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: "gs1-128",
        text: `(00)${shipment.sscc}`,
        scale: 3,
        height: 22,
        includetext: true,
        textxalign: "center",
      });
    } catch {
      // Canvas rendering error is ignored in non-canvas environments
    }
  }, [shipment]);

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="h-96 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-900" />
      </div>
    );
  }

  if (detailQuery.error || !shipment) {
    const problem = isApiError(detailQuery.error)
      ? detailQuery.error.problem
      : null;
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Link
          href={`/shipments/${shipmentId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {tDetail("backToList")}
        </Link>
        <ProblemBanner problem={problem} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <Link
            href={`/shipments/${shipment.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {formatSscc(shipment.sscc)}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          {t("print")}
        </Button>
      </div>

      <Card className="border-2 border-black bg-white text-black shadow-sm print:border-black print:shadow-none">
        <CardContent className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4 border-b-2 border-black pb-4 text-xs">
            <div>
              <div className="font-bold uppercase tracking-wider text-neutral-600">
                {t("from")}
              </div>
              <div className="mt-0.5 text-sm font-bold">
                {shipment.origin.name}
              </div>
              <div className="font-mono">
                GLN {formatGln(shipment.origin.gln)}
              </div>
            </div>
            <div>
              <div className="font-bold uppercase tracking-wider text-neutral-600">
                {t("to")}
              </div>
              <div className="mt-0.5 text-sm font-bold">
                {shipment.destination.name}
              </div>
              <div className="font-mono">
                GLN {formatGln(shipment.destination.gln)}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-b-2 border-black pb-4 text-xs">
            <div>
              <span className="font-bold uppercase text-neutral-600">
                {t("product")}:{" "}
              </span>
              <span className="text-base font-bold">
                {shipment.product.name}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div>
                <span className="font-sans font-bold text-neutral-600">
                  {t("gtin")}:{" "}
                </span>
                {formatGtin14(shipment.product.gtin)}
              </div>
              <div>
                <span className="font-sans font-bold text-neutral-600">
                  {t("lot")}:{" "}
                </span>
                {shipment.lot.lot_number}
              </div>
              <div>
                <span className="font-sans font-bold text-neutral-600">
                  {t("expiration")}:{" "}
                </span>
                {shipment.lot.expiration_date}
              </div>
              <div>
                <span className="font-sans font-bold text-neutral-600">
                  {t("quantity")}:{" "}
                </span>
                {formatQuantity(shipment.quantity, locale)}
              </div>
              <div className="col-span-2">
                <span className="font-sans font-bold text-neutral-600">
                  {t("tempRange")}:{" "}
                </span>
                {formatTemperature(shipment.product.min_temp_celsius)} …{" "}
                {formatTemperature(shipment.product.max_temp_celsius)}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-1 text-center">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-600">
              {t("ssccAi")}
            </div>
            <div className="font-mono text-lg font-bold tracking-widest">
              (00) {formatSscc(shipment.sscc)}
            </div>
            <div className="flex justify-center overflow-x-auto py-2">
              <canvas
                ref={canvasRef}
                aria-label={`GS1-128 SSCC ${shipment.sscc}`}
                className="max-w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
