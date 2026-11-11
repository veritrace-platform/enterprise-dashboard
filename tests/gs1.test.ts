import { describe, expect, it } from "vitest";
import {
  computeGs1CheckDigit,
  type Gs1KeyType,
  validateGs1Key,
} from "@/lib/gs1/check-digit";
import { normalizeScannedSscc } from "@/lib/gs1/sscc";

const vectors = {
  valid: [
    { key: "6291041500213", type: "GTIN-13" as Gs1KeyType },
    { key: "8930001001015", type: "GLN" as Gs1KeyType },
    { key: "8934567000017", type: "GLN" as Gs1KeyType },
    { key: "08930001000018", type: "GTIN-14" as Gs1KeyType },
    { key: "08934567001014", type: "GTIN-14" as Gs1KeyType },
    { key: "089300010000000018", type: "SSCC" as Gs1KeyType },
    { key: "089345670000000017", type: "SSCC" as Gs1KeyType },
  ],
  invalid: [
    {
      key: "08930001000015",
      type: "GTIN-14" as Gs1KeyType,
      reason: "CHECK_DIGIT",
    },
    { key: "8930001001016", type: "GLN" as Gs1KeyType, reason: "CHECK_DIGIT" },
    { key: "893000100101", type: "GLN" as Gs1KeyType, reason: "LENGTH" },
    { key: "89300010010A5", type: "GLN" as Gs1KeyType, reason: "NON_NUMERIC" },
    { key: "", type: "GLN" as Gs1KeyType, reason: "LENGTH" },
  ],
  prefix_ownership: {
    valid: [
      { key: "8930001001015", type: "GLN" as Gs1KeyType, gcp: "8930001" },
      { key: "08930001000018", type: "GTIN-14" as Gs1KeyType, gcp: "8930001" },
      { key: "18930001000015", type: "GTIN-14" as Gs1KeyType, gcp: "8930001" },
    ],
    invalid: [
      {
        key: "8934567000017",
        type: "GLN" as Gs1KeyType,
        gcp: "8930001",
        reason: "PREFIX_MISMATCH",
      },
      {
        key: "8934567000018",
        type: "GLN" as Gs1KeyType,
        gcp: "8930001",
        reason: "CHECK_DIGIT",
      },
      {
        key: "08934567001014",
        type: "GTIN-14" as Gs1KeyType,
        gcp: "8930001",
        reason: "PREFIX_MISMATCH",
      },
      {
        key: "89300010000012",
        type: "GTIN-14" as Gs1KeyType,
        gcp: "8930001",
        reason: "PREFIX_MISMATCH",
      },
    ],
  },
};

describe("GS1 Modulo 10 check digit and key validation", () => {
  it("computes reference Modulo 10 check digits", () => {
    expect(computeGs1CheckDigit("629104150021")).toBe(3);
    expect(computeGs1CheckDigit("893000100101")).toBe(5);
    expect(computeGs1CheckDigit("0893000100001")).toBe(8);
    expect(computeGs1CheckDigit("08930001000000001")).toBe(8);
  });

  it("accepts all valid test vectors", () => {
    for (const v of vectors.valid) {
      expect(validateGs1Key(v.key, v.type)).toEqual({
        valid: true,
        normalized: v.key,
      });
    }
  });

  it("reports the exact first failure code for invalid vectors", () => {
    for (const v of vectors.invalid) {
      expect(validateGs1Key(v.key, v.type)).toEqual({
        valid: false,
        code: v.reason,
      });
    }
  });

  it("enforces prefix ownership after check digit verification", () => {
    for (const v of vectors.prefix_ownership.valid) {
      expect(validateGs1Key(v.key, v.type, v.gcp)).toEqual({
        valid: true,
        normalized: v.key,
      });
    }
    for (const v of vectors.prefix_ownership.invalid) {
      expect(validateGs1Key(v.key, v.type, v.gcp)).toEqual({
        valid: false,
        code: v.reason,
      });
    }
  });

  it("normalizes scanned SSCC labels across GS1-128, Digital Link, and plain 18 digits", () => {
    const sscc = "089300010000000018";
    expect(normalizeScannedSscc(sscc)).toBe(sscc);
    expect(normalizeScannedSscc(`(00)${sscc}`)).toBe(sscc);
    expect(normalizeScannedSscc(`00${sscc}`)).toBe(sscc);
    expect(normalizeScannedSscc(`]C100${sscc}`)).toBe(sscc);
    expect(normalizeScannedSscc(`]d2\u001d00${sscc}`)).toBe(sscc);
    expect(
      normalizeScannedSscc(`https://trace.veritrace.vn/00/${sscc}?k=1`),
    ).toBe(sscc);
    expect(normalizeScannedSscc("invalid-barcode")).toBeNull();
  });
});
