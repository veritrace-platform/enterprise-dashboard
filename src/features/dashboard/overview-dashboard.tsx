"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, ThermometerSnowflake, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "@/components/app-shell";
import { ShipmentStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useShipmentSummaryQuery,
  useShipmentsQuery,
} from "@/features/shipments";
import { Link } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-client";
import { canCreateShipment } from "@/lib/auth/permission";
import { formatSscc } from "@/lib/gs1/sscc";
import { formatDateTime, formatQuantity } from "@/utils/format";

export function OverviewDashboard() {
  const { user } = useSession();
  const locale = useLocale();
  const t = useTranslations("overview");
  const tShipments = useTranslations("shipments");
  const tStatus = useTranslations("status");

  const summaryQuery = useShipmentSummaryQuery(Boolean(user));
  const recentShipmentsQuery = useShipmentsQuery({ limit: 5 }, Boolean(user));
  const incidentsSummaryQuery = useQuery({
    queryKey: queryKeys.telemetry.incidentsSummary(),
    queryFn: async () =>
      unwrap(await apiClient.GET("/api/v1/telemetry/incidents/summary")),
    enabled: Boolean(user),
  });

  const createPerm = canCreateShipment(user);
  const summary = summaryQuery.data;
  const incidentCounts = incidentsSummaryQuery.data;
  const recentItems = recentShipmentsQuery.data?.items ?? [];

  const statCards = [
    {
      label: t("totalCreated"),
      value: summary?.created ?? 0,
      tone: "text-foreground",
    },
    {
      label: t("totalInTransit"),
      value: summary?.in_transit ?? 0,
      tone: "text-blue-700 dark:text-blue-400",
    },
    {
      label: t("totalDelivered"),
      value: summary?.delivered ?? 0,
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: t("totalRecalled"),
      value: summary?.recalled ?? 0,
      tone: "text-red-700 dark:text-red-400",
    },
    {
      label: t("openBreaches"),
      value: incidentCounts?.open_count ?? 0,
      tone: "text-red-700 dark:text-red-400",
    },
    {
      label: t("breaches24h"),
      value: incidentCounts?.last_24h_count ?? 0,
      tone: "text-amber-700 dark:text-amber-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        {createPerm.allowed && (
          <Button asChild>
            <Link href="/shipments/new">
              <Plus className="size-4" />
              {t("newShipment")}
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <Card key={card.label} className="py-4">
            <CardContent className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {card.label}
              </p>
              <p className={`font-mono text-2xl font-bold ${card.tone}`}>
                {formatQuantity(card.value, locale)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="py-4">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-muted-foreground" />
            {t("recentShipments")}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/shipments">
              {t("viewAllShipments")}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent>
          {recentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-muted-foreground">
              <ThermometerSnowflake className="size-8 text-muted-foreground" />
              <p>{tShipments("emptyTitle")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tShipments("columns.sscc")}</TableHead>
                  <TableHead>{tShipments("columns.product")}</TableHead>
                  <TableHead>{tShipments("columns.route")}</TableHead>
                  <TableHead>{tShipments("columns.status")}</TableHead>
                  <TableHead>{tShipments("columns.createdAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentItems.map((shipment) => {
                  const created = formatDateTime(shipment.created_at, locale);
                  return (
                    <TableRow key={shipment.id}>
                      <TableCell>
                        <Link
                          href={`/shipments/${shipment.id}`}
                          className="font-mono text-xs font-semibold text-primary hover:underline"
                        >
                          {formatSscc(shipment.sscc)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-medium">
                          {shipment.product.name}
                        </span>{" "}
                        <span className="font-mono text-muted-foreground">
                          ({shipment.lot.lot_number})
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {shipment.origin.name} → {shipment.destination.name}
                      </TableCell>
                      <TableCell>
                        <ShipmentStatusBadge
                          status={shipment.status}
                          label={tStatus(shipment.status)}
                        />
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground"
                        title={created.tooltip}
                      >
                        {created.display}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
