import { type Gs1ValidationResult, validateGs1Key } from "./check-digit";

export function validateGln(gln: string, gcp?: string): Gs1ValidationResult {
  return validateGs1Key(gln, "GLN", gcp);
}

export function formatGln(gln: string): string {
  if (gln.length !== 13) {
    return gln;
  }
  return `${gln.slice(0, 7)} ${gln.slice(7, 12)} ${gln.slice(12)}`;
}

