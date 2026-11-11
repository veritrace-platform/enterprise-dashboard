import { type Gs1ValidationResult, validateGs1Key } from "./check-digit";

const SYMBOLOGY_PREFIX = /^\](?:C1|d2|e0|Q3)/;
const DIGITAL_LINK_SSCC = /\/00\/([0-9]{18})(?:[/?#]|$)/;

const FNC1_CHAR = String.fromCharCode(29);

function stripLeadingFnc1(value: string): string {
  let start = 0;
  while (start < value.length && value[start] === FNC1_CHAR) {
    start += 1;
  }
  return value.slice(start);
}

/**
 * Normalizes a scanned barcode or manual input into an 18-digit SSCC string
 * per docs/domain/gs1-identifiers.md §3.1:
 * - GS1-128 / GS1 DataMatrix element string with or without ]C1 / ]d2 and FNC1 (GS \x1d), AI (00) or 00
 * - QR with GS1 Digital Link containing /00/{sscc}
 * - Plain 18 digits
 */
export function normalizeScannedSscc(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const dlMatch = DIGITAL_LINK_SSCC.exec(trimmed);
  if (dlMatch?.[1]) {
    return dlMatch[1];
  }

  // Strip GS1 symbology identifier (e.g. ]C1, ]d2) and leading FNC1 (ASCII 29)
  const cleaned = stripLeadingFnc1(
    trimmed.replace(SYMBOLOGY_PREFIX, ""),
  ).replace(/\s+/g, "");

  if (/^[0-9]{18}$/.test(cleaned)) {
    return cleaned;
  }

  const bracketedMatch = /^\(00\)([0-9]{18})$/.exec(cleaned);
  if (bracketedMatch?.[1]) {
    return bracketedMatch[1];
  }

  if (cleaned.startsWith("00") && /^[0-9]{20}$/.test(cleaned)) {
    return cleaned.slice(2, 20);
  }

  return null;
}

export function validateSscc(sscc: string): Gs1ValidationResult {
  return validateGs1Key(sscc, "SSCC");
}

export function parseAndValidateSscc(raw: string): Gs1ValidationResult {
  const normalized = normalizeScannedSscc(raw);
  if (!normalized) {
    const stripped = raw.trim();
    return validateGs1Key(stripped, "SSCC");
  }
  return validateGs1Key(normalized, "SSCC");
}

export function formatSscc(sscc: string, gcpLength = 7): string {
  if (sscc.length !== 18) {
    return sscc;
  }
  const ext = sscc.slice(0, 1);
  const prefix = sscc.slice(1, 1 + gcpLength);
  const serial = sscc.slice(1 + gcpLength, 17);
  const check = sscc.slice(17);
  return `${ext} ${prefix} ${serial} ${check}`;
}
