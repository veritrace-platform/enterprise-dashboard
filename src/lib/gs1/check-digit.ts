export type Gs1ErrorCode =
  | "LENGTH"
  | "NON_NUMERIC"
  | "CHECK_DIGIT"
  | "PREFIX_MISMATCH";

export type Gs1KeyType = "GLN" | "GTIN-14" | "GTIN-13" | "SSCC";

export type Gs1ValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; code: Gs1ErrorCode };

const EXPECTED_LENGTHS: Record<Gs1KeyType, number> = {
  GLN: 13,
  "GTIN-13": 13,
  "GTIN-14": 14,
  SSCC: 18,
};

const DIGITS_ONLY = /^[0-9]+$/;

/**
 * Computes the GS1 Modulo 10 check digit for a numeric payload (without the check digit).
 * Weights alternate 3, 1, 3, 1... from the rightmost digit of the payload.
 */
export function computeGs1CheckDigit(payloadWithoutCheck: string): number {
  if (!payloadWithoutCheck || !DIGITS_ONLY.test(payloadWithoutCheck)) {
    throw new Error("GS1 payload must contain only ASCII digits");
  }

  let sum = 0;
  const len = payloadWithoutCheck.length;
  for (let i = 0; i < len; i++) {
    const digit = payloadWithoutCheck.charCodeAt(len - 1 - i) - 48;
    const weight = i % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }

  return (10 - (sum % 10)) % 10;
}

export function hasValidGs1CheckDigit(key: string): boolean {
  if (key.length < 2 || !DIGITS_ONLY.test(key)) {
    return false;
  }
  const payload = key.slice(0, -1);
  const actualCheck = key.charCodeAt(key.length - 1) - 48;
  return computeGs1CheckDigit(payload) === actualCheck;
}

/**
 * Validates a GS1 key in the exact contract order:
 * LENGTH -> NON_NUMERIC -> CHECK_DIGIT -> PREFIX_MISMATCH.
 */
export function validateGs1Key(
  key: string,
  type: Gs1KeyType,
  gcp?: string,
): Gs1ValidationResult {
  const expectedLength = EXPECTED_LENGTHS[type];

  if (key.length !== expectedLength) {
    return { valid: false, code: "LENGTH" };
  }

  if (!DIGITS_ONLY.test(key)) {
    return { valid: false, code: "NON_NUMERIC" };
  }

  if (!hasValidGs1CheckDigit(key)) {
    return { valid: false, code: "CHECK_DIGIT" };
  }

  if (gcp) {
    if (type === "GLN" && !key.startsWith(gcp)) {
      return { valid: false, code: "PREFIX_MISMATCH" };
    }
    if (type === "GTIN-14" && !key.slice(1).startsWith(gcp)) {
      return { valid: false, code: "PREFIX_MISMATCH" };
    }
  }

  return { valid: true, normalized: key };
}

export function validateGtin14(
  input: string,
  gcp?: string,
): Gs1ValidationResult {
  return validateGs1Key(input, "GTIN-14", gcp);
}

export function padGtinTo14(input: string): string {
  const digits = input.trim();
  if (
    DIGITS_ONLY.test(digits) &&
    (digits.length === 8 || digits.length === 12 || digits.length === 13)
  ) {
    return digits.padStart(14, "0");
  }
  return digits;
}

export function formatGtin14(gtin: string): string {
  if (gtin.length !== 14) {
    return gtin;
  }
  return `${gtin.slice(0, 1)} ${gtin.slice(1, 8)} ${gtin.slice(8, 13)} ${gtin.slice(13)}`;
}

