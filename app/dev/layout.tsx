import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import "../globals.css";
import "../site.css";
import "../admin.css";
import "../cabinet.css";
import "../dev.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.dev");
  return { title: t("title"), robots: { index: false, follow: false } };
}

// Стенды — только для разработки. Защита здесь, до любых ожиданий: стенд, который сначала ждёт
// searchParams, звал notFound() уже после статичной оболочки — ответ уходил с кодом 200 (приёмка
// фазы 1). Свои devOnlyStand / devOnly у стендов и действий остаются вторым рубежом.
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production") notFound();
  return <RootDocument lang={ADMIN_LOCALE}>{children}</RootDocument>;
}
