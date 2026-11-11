"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { ProblemBanner } from "@/components/problem-banner";
import { Link, useRouter } from "@/i18n/navigation";
import { apiClient } from "@/lib/api/client";
import { type ApiProblem, parseProblem } from "@/lib/api/errors";
import { canAccessDashboard } from "@/lib/auth/permission";
import { accessSessionSchema, setAccessSession } from "@/lib/auth/session";
import { validateGln } from "@/lib/gs1/gln";
import { cn } from "@/lib/utils";
import { AuthShell } from "./auth-shell";
import {
  HeroArrowLeftIcon,
  HeroBuildingOffice2Icon,
  HeroEyeIcon,
  HeroEyeSlashIcon,
  HeroLockClosedIcon,
} from "./heroicons";

type RegisterFieldKey =
  | "tenant.code"
  | "tenant.tax_code"
  | "tenant.legal_name"
  | "tenant.gs1_company_prefix"
  | "headquarters.name"
  | "headquarters.gln"
  | "headquarters.city"
  | "headquarters.address"
  | "headquarters.latitude"
  | "headquarters.longitude"
  | "headquarters.geo_fence_radius_meters"
  | "admin.full_name"
  | "admin.phone"
  | "admin.email"
  | "admin.password";

type FieldErrors = Partial<Record<RegisterFieldKey, string>>;

const TENANT_CODE_REGEX = /^[A-Z0-9_]{3,32}$/;
const TAX_CODE_REGEX = /^[0-9]{10}(-[0-9]{3})?$/;
const GCP_REGEX = /^[0-9]{6,10}$/;
const PHONE_REGEX = /^\+?[0-9(][0-9 ().-]*[0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterForm() {
  const tAuth = useTranslations("auth");
  const tReg = useTranslations("auth.register");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const baseId = useId();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 01: Tenant fields
  const [tenantCode, setTenantCode] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [legalName, setLegalName] = useState("");
  const [gcp, setGcp] = useState("");

  // Step 02: Headquarters fields
  const [hqName, setHqName] = useState("");
  const [hqGln, setHqGln] = useState("");
  const [hqCity, setHqCity] = useState("");
  const [hqAddress, setHqAddress] = useState("");
  const [hqLatitude, setHqLatitude] = useState("");
  const [hqLongitude, setHqLongitude] = useState("");
  const [hqRadius, setHqRadius] = useState("200");

  // Step 03: Admin fields
  const [adminFullName, setAdminFullName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: RegisterFieldKey) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function validateStep1(): FieldErrors {
    const errors: FieldErrors = {};
    const normalizedCode = tenantCode.trim().toUpperCase();
    const normalizedTax = taxCode.trim();
    const normalizedLegal = legalName.trim();
    const normalizedGcp = gcp.trim();

    if (!normalizedCode) {
      errors["tenant.code"] = tErrors("field.REQUIRED");
    } else if (!TENANT_CODE_REGEX.test(normalizedCode)) {
      errors["tenant.code"] = tErrors("field.INVALID_FORMAT");
    }

    if (!normalizedTax) {
      errors["tenant.tax_code"] = tErrors("field.REQUIRED");
    } else if (!TAX_CODE_REGEX.test(normalizedTax)) {
      errors["tenant.tax_code"] = tErrors("field.INVALID_FORMAT");
    }

    if (!normalizedLegal) {
      errors["tenant.legal_name"] = tErrors("field.REQUIRED");
    } else if (normalizedLegal.length > 255) {
      errors["tenant.legal_name"] = tErrors("field.TOO_LONG");
    }

    if (!normalizedGcp) {
      errors["tenant.gs1_company_prefix"] = tErrors("field.REQUIRED");
    } else if (!GCP_REGEX.test(normalizedGcp)) {
      errors["tenant.gs1_company_prefix"] = tErrors("field.INVALID_FORMAT");
    }

    return errors;
  }

  function validateStep2(): FieldErrors {
    const errors: FieldErrors = {};
    const normalizedGcp = gcp.trim();
    const normalizedHqName = hqName.trim();
    const normalizedGln = hqGln.trim();
    const normalizedCity = hqCity.trim();
    const normalizedAddress = hqAddress.trim();
    const parsedLat = Number(hqLatitude.trim());
    const parsedLng = Number(hqLongitude.trim());
    const parsedRadius = Number(hqRadius.trim());

    if (!normalizedHqName) {
      errors["headquarters.name"] = tErrors("field.REQUIRED");
    } else if (normalizedHqName.length > 255) {
      errors["headquarters.name"] = tErrors("field.TOO_LONG");
    }

    if (!normalizedGln) {
      errors["headquarters.gln"] = tErrors("field.REQUIRED");
    } else {
      const glnValidation = validateGln(
        normalizedGln,
        normalizedGcp || undefined,
      );
      if (!glnValidation.valid) {
        errors["headquarters.gln"] = tErrors(`field.${glnValidation.code}`);
      }
    }

    if (!normalizedCity) {
      errors["headquarters.city"] = tErrors("field.REQUIRED");
    } else if (normalizedCity.length > 100) {
      errors["headquarters.city"] = tErrors("field.TOO_LONG");
    }

    if (!normalizedAddress) {
      errors["headquarters.address"] = tErrors("field.REQUIRED");
    } else if (normalizedAddress.length > 500) {
      errors["headquarters.address"] = tErrors("field.TOO_LONG");
    }

    if (!hqLatitude.trim()) {
      errors["headquarters.latitude"] = tErrors("field.REQUIRED");
    } else if (Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      errors["headquarters.latitude"] = tErrors("field.OUT_OF_RANGE");
    }

    if (!hqLongitude.trim()) {
      errors["headquarters.longitude"] = tErrors("field.REQUIRED");
    } else if (Number.isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      errors["headquarters.longitude"] = tErrors("field.OUT_OF_RANGE");
    }

    if (!hqRadius.trim()) {
      errors["headquarters.geo_fence_radius_meters"] =
        tErrors("field.REQUIRED");
    } else if (
      !Number.isInteger(parsedRadius) ||
      parsedRadius < 50 ||
      parsedRadius > 5000
    ) {
      errors["headquarters.geo_fence_radius_meters"] =
        tErrors("field.OUT_OF_RANGE");
    }

    const normalizedAdminName = adminFullName.trim();
    const normalizedPhone = adminPhone.trim();
    const normalizedEmail = adminEmail.trim();

    if (!normalizedAdminName) {
      errors["admin.full_name"] = tErrors("field.REQUIRED");
    } else if (normalizedAdminName.length > 255) {
      errors["admin.full_name"] = tErrors("field.TOO_LONG");
    }

    if (!normalizedPhone) {
      errors["admin.phone"] = tErrors("field.REQUIRED");
    } else if (
      normalizedPhone.length < 6 ||
      normalizedPhone.length > 32 ||
      !PHONE_REGEX.test(normalizedPhone)
    ) {
      errors["admin.phone"] = tErrors("field.INVALID_FORMAT");
    }

    if (!normalizedEmail) {
      errors["admin.email"] = tErrors("field.REQUIRED");
    } else if (
      normalizedEmail.length > 254 ||
      !EMAIL_REGEX.test(normalizedEmail)
    ) {
      errors["admin.email"] = tErrors("field.INVALID_FORMAT");
    }

    if (!adminPassword) {
      errors["admin.password"] = tErrors("field.REQUIRED");
    } else if (adminPassword.length < 12) {
      errors["admin.password"] = tErrors("field.TOO_SHORT");
    } else if (adminPassword.length > 128) {
      errors["admin.password"] = tErrors("field.TOO_LONG");
    }

    return errors;
  }

  function handleContinueStep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);

    const step1Errors = validateStep1();
    if (Object.keys(step1Errors).length > 0) {
      setFieldErrors(step1Errors);
      return;
    }

    setFieldErrors({});
    setStep(2);
  }

  async function handleSubmitRegistration(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setProblem(null);

    const step1Errors = validateStep1();
    if (Object.keys(step1Errors).length > 0) {
      setFieldErrors(step1Errors);
      setStep(1);
      return;
    }

    const step2Errors = validateStep2();
    if (Object.keys(step2Errors).length > 0) {
      setFieldErrors(step2Errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      tenant: {
        code: tenantCode.trim().toUpperCase(),
        legal_name: legalName.trim(),
        tax_code: taxCode.trim(),
        gs1_company_prefix: gcp.trim(),
      },
      headquarters: {
        gln: hqGln.trim(),
        name: hqName.trim(),
        address: hqAddress.trim(),
        city: hqCity.trim(),
        latitude: Number(Number(hqLatitude.trim()).toFixed(6)),
        longitude: Number(Number(hqLongitude.trim()).toFixed(6)),
        geo_fence_radius_meters: Number(hqRadius.trim()),
      },
      admin: {
        email: adminEmail.trim(),
        password: adminPassword,
        full_name: adminFullName.trim(),
        phone: adminPhone.trim() || null,
      },
    };

    try {
      const { error, response } = await apiClient.POST("/api/v1/tenants", {
        body: payload,
      });

      if (!response.ok) {
        const parsedProblem = parseProblem(error, response);
        setProblem(parsedProblem);

        if (parsedProblem.errors) {
          const nextFieldErrors: FieldErrors = {};
          let hasStep1Error = false;

          for (const item of parsedProblem.errors) {
            const fieldKey = item.field as RegisterFieldKey;
            nextFieldErrors[fieldKey] = tErrors.has(`field.${item.code}`)
              ? tErrors(`field.${item.code}`)
              : item.message;
            if (item.field.startsWith("tenant.")) {
              hasStep1Error = true;
            }
          }

          setFieldErrors(nextFieldErrors);
          if (hasStep1Error) {
            setStep(1);
          }
        }
        return;
      }

      // Attempt automatic sign-in after successful tenant registration
      const loginResponse = await fetch("/bff/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: payload.admin.email,
          password: payload.admin.password,
        }),
      }).catch(() => null);

      if (loginResponse?.ok) {
        const loginBody: unknown = await loginResponse
          .json()
          .catch(() => null);
        const sessionResult = accessSessionSchema.safeParse(loginBody);
        if (sessionResult.success) {
          setAccessSession(sessionResult.data);
          if (canAccessDashboard(sessionResult.data.user)) {
            router.replace("/");
            return;
          }
        }
      }

      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass = (hasError: boolean, extra?: string) =>
    cn(
      "h-11.5 w-full rounded-xl border bg-[#FAFCFF] px-3.5 text-[13.5px] font-medium text-slate-900 transition outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2",
      hasError
        ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
        : "border-slate-200/90 focus:border-[#2563EB] focus:ring-[#2563EB]/15",
      extra,
    );

  return (
    <AuthShell activeTab="register">
      <header className="space-y-1.5 border-b border-slate-100 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1
            id="auth-page-heading"
            className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]"
          >
            {tAuth("registerTenant")}
          </h1>

          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-[#2563EB] transition hover:bg-blue-50"
            >
              <HeroArrowLeftIcon className="size-3.5" />
              <span>{tAuth("backToStep1")}</span>
            </button>
          )}
        </div>
        <p className="text-[13.5px] font-medium text-slate-500">
          {tAuth("registerSubtitle")}
        </p>
        <p className="pt-0.5 text-[11.5px] font-medium text-slate-400">
          <small className="text-[11.5px]">{tAuth("requiredNote")}</small>
        </p>
      </header>

      <ProblemBanner problem={problem} />

      {step === 1 ? (
        <form
          onSubmit={handleContinueStep}
          noValidate
          aria-labelledby="step-01-heading"
          className="space-y-6"
        >
          {/* Section 01: Enterprise Information */}
          <fieldset className="space-y-4">
            <legend className="sr-only">{tReg("step1Title")}</legend>

            <header className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EBF2FF] text-xs font-bold text-[#2563EB]"
              >
                01
              </span>
              <div>
                <h2
                  id="step-01-heading"
                  className="text-[15px] font-bold text-slate-900"
                >
                  {tReg("step1Title")}
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  {tReg("step1Desc")}
                </p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Enterprise Code */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-tenant-code`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("tenantCode")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-tenant-code`}
                  name="tenantCode"
                  type="text"
                  autoComplete="organization"
                  placeholder={tReg("tenantCodePlaceholder")}
                  value={tenantCode}
                  onChange={(e) => {
                    setTenantCode(e.target.value.toUpperCase());
                    clearFieldError("tenant.code");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["tenant.code"])}
                  className={inputClass(Boolean(fieldErrors["tenant.code"]))}
                  required
                />
                {fieldErrors["tenant.code"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["tenant.code"]}
                  </p>
                )}
              </div>

              {/* Tax Code */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-tax-code`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("taxCode")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-tax-code`}
                  name="taxCode"
                  type="text"
                  inputMode="numeric"
                  placeholder={tReg("taxCodePlaceholder")}
                  value={taxCode}
                  onChange={(e) => {
                    setTaxCode(e.target.value);
                    clearFieldError("tenant.tax_code");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["tenant.tax_code"])}
                  className={inputClass(Boolean(fieldErrors["tenant.tax_code"]))}
                  required
                />
                {fieldErrors["tenant.tax_code"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["tenant.tax_code"]}
                  </p>
                )}
              </div>
            </div>

            {/* Legal Enterprise Name */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-legal-name`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("legalName")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <input
                id={`${baseId}-legal-name`}
                name="legalName"
                type="text"
                placeholder={tReg("legalNamePlaceholder")}
                value={legalName}
                onChange={(e) => {
                  setLegalName(e.target.value);
                  clearFieldError("tenant.legal_name");
                }}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors["tenant.legal_name"])}
                className={inputClass(
                  Boolean(fieldErrors["tenant.legal_name"]),
                )}
                required
              />
              {fieldErrors["tenant.legal_name"] && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["tenant.legal_name"]}
                </p>
              )}
            </div>

            {/* GS1 Company Prefix */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-gcp`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("gcp")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <div className="relative flex items-center">
                <input
                  id={`${baseId}-gcp`}
                  name="gs1CompanyPrefix"
                  type="text"
                  inputMode="numeric"
                  placeholder={tReg("gcpPlaceholder")}
                  value={gcp}
                  onChange={(e) => {
                    setGcp(e.target.value);
                    clearFieldError("tenant.gs1_company_prefix");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(
                    fieldErrors["tenant.gs1_company_prefix"],
                  )}
                  className={inputClass(
                    Boolean(fieldErrors["tenant.gs1_company_prefix"]),
                    "pr-40",
                  )}
                  required
                />
                <span className="pointer-events-none absolute right-2.5 rounded-md bg-[#EEF3FB] px-2.5 py-1 text-[11px] font-bold text-slate-500">
                  {tReg("gcpBadge")}
                </span>
              </div>
              {fieldErrors["tenant.gs1_company_prefix"] && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["tenant.gs1_company_prefix"]}
                </p>
              )}
            </div>
          </fieldset>

          <div className="space-y-3 pt-1">
            <button
              type="submit"
              className="inline-flex h-12.5 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0B1324] px-6 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#15223E] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              <HeroBuildingOffice2Icon className="size-4.5" />
              <span>{tAuth("continue")}</span>
            </button>

            <p className="text-center text-[12.5px] font-semibold text-slate-400">
              {tAuth("hasAccount")}{" "}
              <Link
                href="/login"
                className="font-bold text-[#2563EB] hover:underline"
              >
                {tAuth("signIn")}
              </Link>
            </p>
          </div>
        </form>
      ) : (
        <form
          onSubmit={handleSubmitRegistration}
          noValidate
          aria-label={tAuth("registerTenant")}
          className="space-y-6"
        >
          {/* Section 02: Headquarters */}
          <fieldset className="space-y-4">
            <legend className="sr-only">{tReg("step2Title")}</legend>

            <header className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EBF2FF] text-xs font-bold text-[#2563EB]"
              >
                02
              </span>
              <div>
                <h2
                  id="step-02-heading"
                  className="text-[15px] font-bold text-slate-900"
                >
                  {tReg("step2Title")}
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  {tReg("step2Desc")}
                </p>
              </div>
            </header>

            {/* Headquarters Name */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-hq-name`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("hqName")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <input
                id={`${baseId}-hq-name`}
                name="hqName"
                type="text"
                placeholder={tReg("hqNamePlaceholder")}
                value={hqName}
                onChange={(e) => {
                  setHqName(e.target.value);
                  clearFieldError("headquarters.name");
                }}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors["headquarters.name"])}
                className={inputClass(Boolean(fieldErrors["headquarters.name"]))}
                required
              />
              {fieldErrors["headquarters.name"] && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["headquarters.name"]}
                </p>
              )}
            </div>

            {/* Headquarters GLN & City */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-hq-gln`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("hqGln")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <div className="relative flex items-center">
                  <input
                    id={`${baseId}-hq-gln`}
                    name="hqGln"
                    type="text"
                    inputMode="numeric"
                    placeholder={tReg("hqGlnPlaceholder")}
                    value={hqGln}
                    onChange={(e) => {
                      setHqGln(e.target.value);
                      clearFieldError("headquarters.gln");
                    }}
                    aria-required="true"
                    aria-invalid={Boolean(fieldErrors["headquarters.gln"])}
                    className={inputClass(
                      Boolean(fieldErrors["headquarters.gln"]),
                      "pr-20",
                    )}
                    required
                  />
                  <span className="pointer-events-none absolute right-2.5 rounded-md bg-[#EEF3FB] px-2 py-1 text-[10.5px] font-bold text-slate-500">
                    {tReg("hqGlnBadge")}
                  </span>
                </div>
                {fieldErrors["headquarters.gln"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["headquarters.gln"]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-hq-city`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("hqCity")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-hq-city`}
                  name="hqCity"
                  type="text"
                  placeholder={tReg("hqCityPlaceholder")}
                  value={hqCity}
                  onChange={(e) => {
                    setHqCity(e.target.value);
                    clearFieldError("headquarters.city");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["headquarters.city"])}
                  className={inputClass(
                    Boolean(fieldErrors["headquarters.city"]),
                  )}
                  required
                />
                {fieldErrors["headquarters.city"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["headquarters.city"]}
                  </p>
                )}
              </div>
            </div>

            {/* Headquarters Address */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-hq-address`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("hqAddress")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <input
                id={`${baseId}-hq-address`}
                name="hqAddress"
                type="text"
                placeholder={tReg("hqAddressPlaceholder")}
                value={hqAddress}
                onChange={(e) => {
                  setHqAddress(e.target.value);
                  clearFieldError("headquarters.address");
                }}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors["headquarters.address"])}
                className={inputClass(
                  Boolean(fieldErrors["headquarters.address"]),
                )}
                required
              />
              {fieldErrors["headquarters.address"] && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["headquarters.address"]}
                </p>
              )}
            </div>

            {/* Latitude & Longitude */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-hq-lat`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("hqLatitude")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-hq-lat`}
                  name="hqLatitude"
                  type="text"
                  inputMode="decimal"
                  placeholder={tReg("hqLatitudePlaceholder")}
                  value={hqLatitude}
                  onChange={(e) => {
                    setHqLatitude(e.target.value);
                    clearFieldError("headquarters.latitude");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["headquarters.latitude"])}
                  className={inputClass(
                    Boolean(fieldErrors["headquarters.latitude"]),
                  )}
                  required
                />
                {fieldErrors["headquarters.latitude"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["headquarters.latitude"]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-hq-lng`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("hqLongitude")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-hq-lng`}
                  name="hqLongitude"
                  type="text"
                  inputMode="decimal"
                  placeholder={tReg("hqLongitudePlaceholder")}
                  value={hqLongitude}
                  onChange={(e) => {
                    setHqLongitude(e.target.value);
                    clearFieldError("headquarters.longitude");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["headquarters.longitude"])}
                  className={inputClass(
                    Boolean(fieldErrors["headquarters.longitude"]),
                  )}
                  required
                />
                {fieldErrors["headquarters.longitude"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["headquarters.longitude"]}
                  </p>
                )}
              </div>
            </div>

            {/* Geo-fence Radius */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-hq-radius`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("hqRadius")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <div className="relative flex items-center">
                <input
                  id={`${baseId}-hq-radius`}
                  name="hqRadius"
                  type="number"
                  min={50}
                  max={5000}
                  placeholder={tReg("hqRadiusPlaceholder")}
                  value={hqRadius}
                  onChange={(e) => {
                    setHqRadius(e.target.value);
                    clearFieldError("headquarters.geo_fence_radius_meters");
                  }}
                  aria-required="true"
                  aria-describedby={`${baseId}-hq-radius-hint`}
                  aria-invalid={Boolean(
                    fieldErrors["headquarters.geo_fence_radius_meters"],
                  )}
                  className={inputClass(
                    Boolean(
                      fieldErrors["headquarters.geo_fence_radius_meters"],
                    ),
                    "pr-16",
                  )}
                  required
                />
                <span className="pointer-events-none absolute right-2.5 rounded-md bg-[#EEF3FB] px-2.5 py-1 text-[10.5px] font-bold text-slate-500">
                  {tReg("hqRadiusUnit")}
                </span>
              </div>
              {fieldErrors["headquarters.geo_fence_radius_meters"] ? (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["headquarters.geo_fence_radius_meters"]}
                </p>
              ) : (
                <p
                  id={`${baseId}-hq-radius-hint`}
                  className="text-[11px] font-medium text-slate-400"
                >
                  {tReg("hqRadiusHint")}
                </p>
              )}
            </div>
          </fieldset>

          {/* Section 03: Administrator Account */}
          <fieldset className="space-y-4 border-t border-slate-100 pt-5">
            <legend className="sr-only">{tReg("step3Title")}</legend>

            <header className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EBF2FF] text-xs font-bold text-[#2563EB]"
              >
                03
              </span>
              <div>
                <h2
                  id="step-03-heading"
                  className="text-[15px] font-bold text-slate-900"
                >
                  {tReg("step3Title")}
                </h2>
                <p className="text-[12px] font-medium text-slate-500">
                  {tReg("step3Desc")}
                </p>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-admin-name`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("adminFullName")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-admin-name`}
                  name="adminFullName"
                  type="text"
                  autoComplete="name"
                  placeholder={tReg("adminFullNamePlaceholder")}
                  value={adminFullName}
                  onChange={(e) => {
                    setAdminFullName(e.target.value);
                    clearFieldError("admin.full_name");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["admin.full_name"])}
                  className={inputClass(Boolean(fieldErrors["admin.full_name"]))}
                  required
                />
                {fieldErrors["admin.full_name"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["admin.full_name"]}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`${baseId}-admin-phone`}
                  className="block text-[12.5px] font-bold text-slate-800"
                >
                  {tReg("adminPhone")}{" "}
                  <abbr
                    title="required"
                    aria-hidden="true"
                    className="text-rose-500 no-underline"
                  >
                    *
                  </abbr>
                </label>
                <input
                  id={`${baseId}-admin-phone`}
                  name="adminPhone"
                  type="tel"
                  autoComplete="tel"
                  placeholder={tReg("adminPhonePlaceholder")}
                  value={adminPhone}
                  onChange={(e) => {
                    setAdminPhone(e.target.value);
                    clearFieldError("admin.phone");
                  }}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors["admin.phone"])}
                  className={inputClass(Boolean(fieldErrors["admin.phone"]))}
                  required
                />
                {fieldErrors["admin.phone"] && (
                  <p role="alert" className="text-xs font-semibold text-rose-600">
                    {fieldErrors["admin.phone"]}
                  </p>
                )}
              </div>
            </div>

            {/* Admin Email */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-admin-email`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("adminEmail")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <input
                id={`${baseId}-admin-email`}
                name="adminEmail"
                type="email"
                autoComplete="email"
                placeholder={tReg("adminEmailPlaceholder")}
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  clearFieldError("admin.email");
                }}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors["admin.email"])}
                className={inputClass(Boolean(fieldErrors["admin.email"]))}
                required
              />
              {fieldErrors["admin.email"] && (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["admin.email"]}
                </p>
              )}
            </div>

            {/* Admin Password */}
            <div className="space-y-1.5">
              <label
                htmlFor={`${baseId}-admin-password`}
                className="block text-[12.5px] font-bold text-slate-800"
              >
                {tReg("adminPassword")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>
              <div className="relative flex items-center">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 text-slate-400"
                >
                  <HeroLockClosedIcon className="size-4.5" />
                </span>
                <input
                  id={`${baseId}-admin-password`}
                  name="adminPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={tReg("adminPasswordPlaceholder")}
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    clearFieldError("admin.password");
                  }}
                  aria-required="true"
                  aria-describedby={`${baseId}-admin-password-hint`}
                  aria-invalid={Boolean(fieldErrors["admin.password"])}
                  className={inputClass(
                    Boolean(fieldErrors["admin.password"]),
                    "pr-10 pl-10",
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? tAuth("hidePassword") : tAuth("showPassword")
                  }
                  aria-pressed={showPassword}
                  className="absolute right-3 rounded-md p-1 text-slate-400 transition hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-[#2563EB]"
                >
                  {showPassword ? (
                    <HeroEyeIcon className="size-4.5" />
                  ) : (
                    <HeroEyeSlashIcon className="size-4.5" />
                  )}
                </button>
              </div>
              {fieldErrors["admin.password"] ? (
                <p role="alert" className="text-xs font-semibold text-rose-600">
                  {fieldErrors["admin.password"]}
                </p>
              ) : (
                <p
                  id={`${baseId}-admin-password-hint`}
                  className="text-[11px] font-medium text-slate-400"
                >
                  {tReg("adminPasswordHint")}
                </p>
              )}
            </div>
          </fieldset>

          <div className="space-y-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12.5 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#0B1324] px-6 text-[14px] font-bold text-white shadow-sm transition hover:bg-[#15223E] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <HeroBuildingOffice2Icon className="size-4.5" />
              <span>
                {isSubmitting
                  ? tAuth("registering")
                  : tAuth("registerTenant")}
              </span>
            </button>

            <p className="text-center text-[12.5px] font-semibold text-slate-400">
              {tAuth("hasAccount")}{" "}
              <Link
                href="/login"
                className="font-bold text-[#2563EB] hover:underline"
              >
                {tAuth("signIn")}
              </Link>
            </p>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

