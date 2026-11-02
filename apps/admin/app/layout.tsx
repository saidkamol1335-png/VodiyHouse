import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Кабинет Vodiy House", template: "%s · Кабинет Vodiy House" },
  // Кабинет не индексируется никогда; заголовок X-Robots-Tag — в next.config.ts.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#f4f1eb",
  colorScheme: "light",
};

export default function AdminRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={fontVariables} data-motion="lite">
      <body>{children}</body>
    </html>
  );
}
