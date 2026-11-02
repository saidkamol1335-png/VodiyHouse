import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";
import "./admin.css";

export const metadata: Metadata = {
  title: "404 · Кабинет Vodiy House",
  robots: { index: false, follow: false },
};

// Адрес не совпал ни с одним маршрутом кабинета. Обходит все layout.
export default function GlobalNotFound() {
  return (
    <html lang="ru" data-motion="lite" className={fontVariables}>
      <body>
        <main className="container flex flex-col gap-4 py-24">
          <h1 className="heading heading--h2">404</h1>
          <p>
            <Link className="text-muted-foreground" href="/">
              В кабинет
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
