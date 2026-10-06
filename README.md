# VeriTrace Enterprise Dashboard

Web application for enterprise teams managing traceability, inventory, shipments, lots, alerts, and supply-chain operations in the VeriTrace platform.

This repository is currently the dashboard scaffold. The App Router structure, shared UI primitives, feature boundaries, localization files, API, authentication, realtime, and GS1 integration folders are in place; most domain files are still placeholders.

## Tech stack

- Next.js 16 with the App Router and React 19
- TypeScript and Tailwind CSS 4
- shadcn/ui with Radix primitives and Lucide React icons
- TanStack Query for server-state management
- `openapi-typescript` and `openapi-fetch` for typed API integration
- React Hook Form and Zod for forms and validation
- next-intl for Vietnamese (default) and English localization
- Apache ECharts with `echarts-for-react` for data visualization and bwip-js for barcode generation
- Serwist for progressive web app support
- Biome for formatting and linting
- Vitest, Playwright, and MSW for unit, end-to-end, and API-mocking tests

## Requirements

- Node.js 24 LTS
- pnpm through Corepack

## Getting started

```bash
git clone https://github.com/veritrace-platform/enterprise-dashboard.git
cd enterprise-dashboard
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set server-only `API_BASE_URL` for backend integration. Dashboard session routes also require `SESSION_SECRET` with at least 32 random bytes. Do not expose either value through `NEXT_PUBLIC_*` or commit secrets.

## Available scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run Biome checks |
| `pnpm format` | Format source files with Biome |
| `pnpm typecheck` | Run the TypeScript compiler without emitting files |
| `pnpm test` | Run Vitest tests |
| `pnpm test:e2e` | Run Playwright tests |
| `pnpm test:e2e:ui` | Open the Playwright test runner UI |

## Application structure

```text
src/
  app/
    [locale]/       Localized application routes
    layout.tsx      Root layout
  components/ui/    Shared UI primitives
  features/         Domain types and feature entry points
  lib/
    api/             API client and error/query helpers
    auth/            Session, refresh, and permission helpers
    gs1/             GS1 check-digit, GLN, and SSCC helpers
    realtime/        WebSocket and subscription helpers
  messages/          English and Vietnamese translation catalogs
public/              Static assets
```

Feature boundaries currently include:

- Authentication
- Dashboard
- Inventory and products
- Lots
- Shipments
- Alerts and cold-chain monitoring
- Locations
- Recall
- Users and settings

## Routes

Localized routes use the `[locale]` segment. The intended supported locales are `en` and `vi`.

| Route | Purpose |
| --- | --- |
| `/[locale]` | Dashboard entry point |
| `/[locale]/login` | Sign in |
| `/[locale]/register` | Registration |
| `/[locale]/inventory` | Inventory |
| `/[locale]/lots` | Lot management |
| `/[locale]/shipments` | Shipment list and creation |
| `/[locale]/alerts` | Alerts |
| `/[locale]/users` | User management |

These routes are scaffolded and should be considered work in progress until their data and user flows are implemented.

## Development guidelines

- Keep business types and feature logic under `src/features/<feature>`.
- Keep reusable, domain-neutral UI under `src/components/ui`.
- Keep transport and cross-cutting concerns under `src/lib`.
- Add translation keys to both `src/messages/en.json` and `src/messages/vi.json`.
- Keep credentials and environment-specific values out of source control.

## Validation

Run the following before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Deployment

Build and run the application with:

```bash
pnpm build
pnpm start
```

The app can be deployed to any Node.js-compatible host that supports Next.js. Configure backend endpoints and secrets through the deployment environment when those integrations are added.

## Related application

The driver-facing mobile experience lives in [driver-mobile-pwa](https://github.com/veritrace-platform/driver-mobile-pwa).
