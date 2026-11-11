"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HeroArrowRightOnRectangleIcon,
  HeroBuildingOffice2Icon,
  HeroCheckBadgeIcon,
  HeroCodeBracketIcon,
  HeroColdChainIcon,
  HeroCubeLogoIcon,
  HeroDocumentCheckIcon,
  HeroGridIcon,
  HeroKeyIcon,
  HeroLockClosedIcon,
  HeroNetworkIcon,
  HeroShieldCheckIcon,
  HeroSupportIcon,
} from "./heroicons";

interface AuthShellProps {
  activeTab: "login" | "register";
  children: ReactNode;
}

export function AuthShell({ activeTab, children }: AuthShellProps) {
  const tAuth = useTranslations("auth");
  const tTower = useTranslations("auth.tower");
  const tFooter = useTranslations("auth.footer");

  return (
    <main
      itemScope
      itemType="https://schema.org/WebPage"
      className="min-h-screen w-full bg-[#F1F5F9] px-3 py-6 sm:px-6 sm:py-10 lg:flex lg:items-center lg:justify-center"
    >
      <article
        itemScope
        itemType="https://schema.org/SoftwareApplication"
        className="mx-auto grid w-full max-w-[1140px] overflow-hidden rounded-[22px] bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 lg:grid-cols-[430px_1fr]"
      >
        <meta itemProp="applicationCategory" content="BusinessApplication" />
        <meta itemProp="operatingSystem" content="Web" />

        {/* Left Brand & Compliance Panel */}
        <aside
          aria-label={tTower("brandTitle")}
          className="relative flex flex-col justify-between bg-[radial-gradient(ellipse_at_bottom_right,#0F264A_0%,#081020_55%,#060B16_100%)] p-7 text-slate-200 sm:p-9"
        >
          <section className="space-y-6">
            <header className="space-y-5">
              <div className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-blue-500/30 bg-[#0D1B35] text-[#3B82F6] shadow-[0_0_20px_rgba(59,130,246,0.25)]"
                >
                  <HeroCubeLogoIcon className="size-5" />
                </span>
                <p className="leading-tight">
                  <span className="block text-[15px] font-bold tracking-wider">
                    <span className="text-slate-600">
                      {tTower("brandPrefix")}{" "}
                    </span>
                    <strong
                      itemProp="name"
                      className="font-bold text-[#2563EB]"
                    >
                      {tTower("brandTitle")}
                    </strong>
                  </span>
                  <small className="mt-0.5 block font-mono text-[9.5px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                    {tTower("brandSubtitle")}
                  </small>
                </p>
              </div>

              <p
                itemProp="description"
                className="text-[13.5px] leading-[1.65] font-medium text-slate-400"
              >
                {tTower("description")}
              </p>
            </header>

            {/* Core Capabilities */}
            <ul className="space-y-3" aria-label="Core capabilities">
              <li>
                <article className="flex items-start gap-3.5 rounded-xl border border-slate-800/90 bg-[#111B2E]/85 p-4 backdrop-blur-xs">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-[#162644] text-[#60A5FA]"
                  >
                    <HeroGridIcon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <header className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[14px] font-bold text-white">
                        {tTower("feature1Title")}
                      </h2>
                      <mark className="rounded bg-[#0A2E26] px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#34D399] uppercase ring-1 ring-[#10B981]/30">
                        {tTower("feature1Badge")}
                      </mark>
                    </header>
                    <p className="text-[12.5px] leading-relaxed font-medium text-slate-400">
                      {tTower("feature1Desc")}
                    </p>
                  </div>
                </article>
              </li>

              <li>
                <article className="flex items-start gap-3.5 rounded-xl border border-slate-800/90 bg-[#111B2E]/85 p-4 backdrop-blur-xs">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-[#162644] text-[#60A5FA]"
                  >
                    <HeroColdChainIcon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-[14px] font-bold text-white">
                      {tTower("feature2Title")}
                    </h2>
                    <p className="text-[12.5px] leading-relaxed font-medium text-slate-400">
                      {tTower("feature2Desc")}
                    </p>
                  </div>
                </article>
              </li>

              <li>
                <article className="flex items-start gap-3.5 rounded-xl border border-slate-800/90 bg-[#111B2E]/85 p-4 backdrop-blur-xs">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-blue-500/20 bg-[#162644] text-[#60A5FA]"
                  >
                    <HeroNetworkIcon className="size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-[14px] font-bold text-white">
                      {tTower("feature3Title")}
                    </h2>
                    <p className="text-[12.5px] leading-relaxed font-medium text-slate-400">
                      {tTower("feature3Desc")}
                    </p>
                  </div>
                </article>
              </li>
            </ul>

            {/* Security & Certifications */}
            <section
              aria-labelledby="security-certifications-heading"
              className="pt-2"
            >
              <h2
                id="security-certifications-heading"
                className="mb-3 text-[11px] font-bold tracking-[0.08em] text-slate-400 uppercase"
              >
                {tTower("securityHeading")}
              </h2>

              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <li className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#111B2E]/90 px-3 py-2.5 text-[11.5px] font-bold text-slate-200">
                  <HeroCheckBadgeIcon className="size-4 shrink-0 text-[#3B82F6]" />
                  <span>{tTower("cert1")}</span>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#111B2E]/90 px-3 py-2.5 text-[11.5px] font-bold text-slate-200">
                  <HeroLockClosedIcon className="size-4 shrink-0 text-[#3B82F6]" />
                  <span>{tTower("cert2")}</span>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#111B2E]/90 px-3 py-2.5 text-[11.5px] font-bold text-slate-200">
                  <HeroDocumentCheckIcon className="size-4 shrink-0 text-[#3B82F6]" />
                  <span>{tTower("cert3")}</span>
                </li>
                <li className="flex items-center gap-2.5 rounded-lg border border-slate-800/90 bg-[#111B2E]/90 px-3 py-2.5 text-[11.5px] font-bold text-slate-200">
                  <HeroKeyIcon className="size-4 shrink-0 text-[#3B82F6]" />
                  <span>{tTower("cert4")}</span>
                </li>
              </ul>
            </section>
          </section>

          <footer className="mt-10 border-t border-slate-800/80 pt-4 text-right">
            <small className="font-mono text-[11px] font-semibold tracking-wide text-[#3B82F6]">
              {tTower("protocolTag")}
            </small>
          </footer>
        </aside>

        {/* Right Form Panel */}
        <section
          aria-labelledby="auth-page-heading"
          className="flex flex-col justify-between bg-white px-6 py-7 sm:px-11 sm:py-9"
        >
          <div className="space-y-6">
            {/* Top Mode Switcher Navigation */}
            <nav aria-label="Authentication navigation">
              <ul className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#EDF2FA] p-1.5">
                <li>
                  <Link
                    href="/login"
                    aria-current={activeTab === "login" ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] transition-all",
                      activeTab === "login"
                        ? "bg-white font-bold text-slate-900 shadow-xs"
                        : "font-semibold text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <HeroArrowRightOnRectangleIcon
                      className={cn(
                        "size-4",
                        activeTab === "login"
                          ? "text-[#2563EB]"
                          : "text-slate-500",
                      )}
                    />
                    <span>{tAuth("signIn")}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    href="/register"
                    aria-current={activeTab === "register" ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] transition-all",
                      activeTab === "register"
                        ? "bg-white font-bold text-slate-900 shadow-xs"
                        : "font-semibold text-slate-600 hover:text-slate-900",
                    )}
                  >
                    <HeroBuildingOffice2Icon
                      className={cn(
                        "size-4",
                        activeTab === "register"
                          ? "text-[#2563EB]"
                          : "text-slate-500",
                      )}
                    />
                    <span>{tAuth("registerTenant")}</span>
                  </Link>
                </li>
              </ul>
            </nav>

            {children}
          </div>

          <footer className="mt-8 border-t border-slate-100 pt-5">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-semibold text-slate-500">
              <li className="inline-flex items-center gap-1.5">
                <HeroSupportIcon className="size-4 text-slate-400" />
                <span>{tFooter("support")}</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <HeroCodeBracketIcon className="size-4 text-slate-400" />
                <span>{tFooter("docs")}</span>
              </li>
              <li className="inline-flex items-center gap-1.5">
                <HeroShieldCheckIcon className="size-4 text-slate-400" />
                <span>{tFooter("compliance")}</span>
              </li>
            </ul>
          </footer>
        </section>
      </article>
    </main>
  );
}

