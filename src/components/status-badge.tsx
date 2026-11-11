import { Badge } from "@/components/ui/badge";
import type { ShipmentStatus } from "@/lib/auth/permission";
import { cn } from "@/lib/utils";

const SHIPMENT_STATUS_STYLES: Record<ShipmentStatus, string> = {
  CREATED:
    "border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200",
  IN_TRANSIT:
    "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200",
  DELIVERED:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  CANCELLED:
    "border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
  RECALLED:
    "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200",
};

export function ShipmentStatusBadge({
  status,
  label,
  className,
}: {
  status: ShipmentStatus;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(SHIPMENT_STATUS_STYLES[status], className)}
    >
      {label}
    </Badge>
  );
}

export function BreachStateBadge({
  open,
  label,
  className,
}: {
  open: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        open
          ? "border-red-300 bg-red-100 text-red-900 dark:border-red-800 dark:bg-red-950/70 dark:text-red-200"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

