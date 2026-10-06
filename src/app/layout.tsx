import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/lib/query-client";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang={routing.defaultLocale}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
