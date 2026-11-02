import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LeadProvider } from "@/components/LeadDialog";
import { RootDocument } from "@/components/RootDocument";
import { ADMIN_LOCALE } from "@/lib/i18n/routing";
import "../globals.css";
import "../site.css";
import "../admin.css";
import "../cabinet.css";
import "../calc.css";
import "../complex.css";
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
  // Окно заявки — как на сайте (шаг 3.7): кнопки заявок стендов отправляют настоящую заявку.
  return (
    <RootDocument lang={ADMIN_LOCALE}>
      {/* Стенды считают запросы своих действий: окно заявки — по нажатию, без предзагрузки. */}
      <LeadProvider preload={false}>{children}</LeadProvider>
    </RootDocument>
  );
}
