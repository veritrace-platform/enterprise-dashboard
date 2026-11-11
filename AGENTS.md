Nguyên tắc:
- Không chào hỏi, trả lời ngắn gọn, dùng Edit thay vì Write lại toàn file.
- Nguyên tắc Karpathy: suy nghĩ trước khi code, code tối thiểu, sửa đúng phạm vi (surgical), luôn có điều kiện verify.
- Ưu tiên Server Components, 'use client' chỉ ở leaf node.
- Không dùng any; validate bằng Zod: form, problem document, message WebSocket, response của BFF. Response REST khác tin type sinh từ OpenAPI (src/lib/api/core.d.ts, telemetry.d.ts).
- Data fetching qua TanStack Query v5 với Query Key Factory dạng [domain, action, params].
- UI: Tailwind + Shadcn UI (@/components/ui/), icon lucide-react, animation Framer Motion.
- Package manager: pnpm (không dùng npm/package-lock.json).
- Verify: pnpm lint:fix → pnpm format → pnpm format:check → pnpm typecheck → pnpm build.

