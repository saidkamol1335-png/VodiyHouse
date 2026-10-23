import type { Metadata } from "next";
import Link from "next/link";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";
import "./site.css";

export const metadata: Metadata = {
  title: "404 · Vodiy House",
};

// Адрес не совпал ни с одним маршрутом. Обходит все layout, поэтому тема — светлая по умолчанию.
export default function GlobalNotFound() {
  return (
    <html lang="uz" data-theme="light" data-motion="lite" className={fontVariables}>
      <body>
        <main className="container flex flex-col gap-4 py-24">
          <h1 className="heading heading--h2">404</h1>
          <p className="flex gap-4">
            <Link className="text-muted-foreground" href="/uz">
              O‘zbekcha
            </Link>
            <Link className="text-muted-foreground" href="/ru">
              Русский
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
