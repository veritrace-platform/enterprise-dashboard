"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { z } from "zod";
import { ProblemBanner } from "@/components/problem-banner";
import { useRouter } from "@/i18n/navigation";
import { type ApiProblem, parseProblem } from "@/lib/api/errors";
import { canAccessDashboard } from "@/lib/auth/permission";
import { accessSessionSchema, setAccessSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { AuthShell } from "./auth-shell";
import {
  HeroEyeIcon,
  HeroEyeSlashIcon,
  HeroLockClosedIcon,
  HeroUserBadgeIcon,
} from "./heroicons";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export function LoginForm() {
  const tAuth = useTranslations("auth");
  const tErrors = useTranslations("errors");
  const router = useRouter();

  const emailId = useId();
  const emailErrorId = useId();
  const passwordId = useId();
  const passwordErrorId = useId();
  const rememberId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProblem(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email") {
          nextErrors.email = tErrors("field.INVALID_FORMAT");
        } else if (key === "password") {
          nextErrors.password = tErrors("field.REQUIRED");
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/bff/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(parsed.data),
      });

      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const parsedProblem = parseProblem(body, response);
        setProblem(parsedProblem);
        if (parsedProblem.errors) {
          const serverFields: { email?: string; password?: string } = {};
          for (const item of parsedProblem.errors) {
            if (item.field === "email" || item.field === "password") {
              serverFields[item.field] = tErrors.has(`field.${item.code}`)
                ? tErrors(`field.${item.code}`)
                : item.message;
            }
          }
          setFieldErrors(serverFields);
        }
        return;
      }

      const sessionResult = accessSessionSchema.safeParse(body);
      if (!sessionResult.success) {
        setProblem(parseProblem(null, response));
        return;
      }

      setAccessSession(sessionResult.data);
      if (canAccessDashboard(sessionResult.data.user)) {
        router.replace("/");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell activeTab="login">
      <header className="sr-only">
        <h1 id="auth-page-heading">{tAuth("signInCta")}</h1>
        <p>{tAuth("loginSubtitle")}</p>
      </header>

      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={tAuth("loginTitle")}
        className="space-y-5 pt-1"
      >
        <ProblemBanner problem={problem} />

        <fieldset className="space-y-5">
          <legend className="sr-only">{tAuth("loginTitle")}</legend>

          {/* Email / User GLN Field */}
          <div className="space-y-2">
            <label
              htmlFor={emailId}
              className="block text-[13.5px] font-bold text-slate-800"
            >
              {tAuth("email")}{" "}
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
                <HeroUserBadgeIcon className="size-5" />
              </span>
              <input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                placeholder={tAuth("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? emailErrorId : undefined}
                className={cn(
                  "h-12 w-full rounded-xl border bg-[#FAFCFF] pr-36 pl-11 text-[14px] font-medium text-slate-900 transition outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2",
                  fieldErrors.email
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-200/90 focus:border-[#2563EB] focus:ring-[#2563EB]/15",
                )}
                required
              />
              <span className="pointer-events-none absolute right-2.5 rounded-md bg-[#EEF3FB] px-2.5 py-1 text-[11px] font-bold tracking-wide text-slate-500">
                {tAuth("emailBadge")}
              </span>
            </div>

            {fieldErrors.email && (
              <p
                id={emailErrorId}
                role="alert"
                className="text-xs font-semibold text-rose-600"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={passwordId}
                className="block text-[13.5px] font-bold text-slate-800"
              >
                {tAuth("password")}{" "}
                <abbr
                  title="required"
                  aria-hidden="true"
                  className="text-rose-500 no-underline"
                >
                  *
                </abbr>
              </label>

              <a
                href="#forgot-password"
                onClick={(e) => e.preventDefault()}
                className="text-[12.5px] font-bold text-[#2563EB] hover:underline"
              >
                {tAuth("forgotPassword")}
              </a>
            </div>

            <div className="relative flex items-center">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 text-slate-400"
              >
                <HeroLockClosedIcon className="size-5" />
              </span>
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder={tAuth("passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password ? passwordErrorId : undefined
                }
                className={cn(
                  "h-12 w-full rounded-xl border bg-[#FAFCFF] pr-11 pl-11 text-[14px] font-medium text-slate-900 transition outline-none placeholder:text-slate-400 focus:bg-white focus:ring-2",
                  fieldErrors.password
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                    : "border-slate-200/90 focus:border-[#2563EB] focus:ring-[#2563EB]/15",
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
                  <HeroEyeSlashIcon className="size-5" />
                ) : (
                  <HeroEyeIcon className="size-5" />
                )}
              </button>
            </div>

            {fieldErrors.password && (
              <p
                id={passwordErrorId}
                role="alert"
                className="text-xs font-semibold text-rose-600"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Device Compliance Checkbox & Timeout Info */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <label
              htmlFor={rememberId}
              className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-slate-600 select-none"
            >
              <input
                id={rememberId}
                name="rememberDevice"
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="size-4 rounded border-slate-300 accent-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/30"
              />
              <span>{tAuth("rememberDevice")}</span>
            </label>

            <small className="text-[12px] font-semibold text-slate-400">
              {tAuth("idleTimeout")}
            </small>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#0B1324] px-6 text-[14.5px] font-bold text-white shadow-sm transition hover:bg-[#15223E] focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <HeroLockClosedIcon className="size-4.5" />
          <span>
            {isSubmitting ? tAuth("signingIn") : tAuth("signInCta")}
          </span>
        </button>
      </form>
    </AuthShell>
  );
}
