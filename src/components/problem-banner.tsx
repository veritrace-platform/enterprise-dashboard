"use client";

import { AlertCircle, Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ApiProblem } from "@/lib/api/errors";

const KNOWN_ERROR_CODES = new Set([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "TOKEN_EXPIRED",
  "INVALID_CREDENTIALS",
  "REFRESH_TOKEN_INVALID",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "IDENTIFIER_ALREADY_REGISTERED",
  "INVALID_STATE_TRANSITION",
  "SHIPMENT_RECALLED_LOCKED",
  "LOT_RECALLED",
  "INSUFFICIENT_STOCK",
  "SSCC_SERIAL_EXHAUSTED",
  "INVALID_GS1_IDENTIFIER",
  "SSCC_MISMATCH",
  "OUTSIDE_GEOFENCE",
  "PICKUP_CODE_INVALID",
  "PICKUP_CODE_EXPIRED",
  "PICKUP_CODE_LOCKED",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
]);

export function ProblemBanner({
  problem,
  className,
}: {
  problem: ApiProblem | null;
  className?: string;
}) {
  const tErrors = useTranslations("errors");
  const tApp = useTranslations("app");
  const [copied, setCopied] = useState(false);

  if (!problem) {
    return null;
  }

  const isKnown = KNOWN_ERROR_CODES.has(problem.code);
  const message = isKnown
    ? tErrors(problem.code, {
        remaining: problem.remaining_attempts ?? 0,
        distance:
          problem.distance_meters !== undefined
            ? Math.round(problem.distance_meters)
            : 0,
        allowed:
          problem.allowed_meters !== undefined
            ? Math.round(problem.allowed_meters)
            : 0,
      })
    : tErrors("INTERNAL_ERROR");

  const showTraceId =
    Boolean(problem.trace_id) &&
    (!isKnown ||
      problem.code === "INTERNAL_ERROR" ||
      problem.code === "SERVICE_UNAVAILABLE" ||
      problem.status >= 500);

  async function copyTraceId() {
    if (!problem?.trace_id) {
      return;
    }
    await navigator.clipboard.writeText(problem.trace_id).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 ${className ?? ""}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1 space-y-1.5">
          <p className="font-medium">{message}</p>
          {showTraceId && problem.trace_id && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <span>
                {tApp("traceId")}:{" "}
                <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono dark:bg-red-900/60">
                  {problem.trace_id}
                </code>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyTraceId}
              >
                {copied ? (
                  <>
                    <Check className="size-3" />
                    {tApp("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="size-3" />
                    {tApp("copy")}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
