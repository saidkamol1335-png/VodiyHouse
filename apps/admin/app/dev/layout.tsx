import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RootDocument } from "@/components/RootDocument";
import { headers } from "next/headers";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import { NONCE_HEADER } from "@/lib/securityHeaders";
import "../globals.css";
import "../admin.css";
import "../cabinet.css";
import "../calc.css";
import "../dev.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dev");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// nonce CSP (фаза F) читается из заголовков — оболочка стендов рендерится на запрос.
export const instant = false;

// Стенды — только для разработки. Защита здесь, до любых ожиданий: стенд, который сначала ждёт
// searchParams, звал notFound() уже после статичной оболочки — ответ уходил с кодом 200 (приёмка
// фазы 1). Свои devOnlyStand / devOnly у стендов и действий остаются вторым рубежом.
export default async function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production") notFound();
  // Стенды кабинета (PLAN §10, п. 20): окна заявки сайта здесь нет — стенды сайта в apps/site.
  // nonce CSP (фаза F): в разработке всё рендерится на запрос, скрипт в <head> — с nonce.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <RootDocument lang={ADMIN_LOCALE} nonce={nonce}>
      {children}
    </RootDocument>
  );
}
