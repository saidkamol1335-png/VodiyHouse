import { getTranslations } from "next-intl/server";
import { AdminDenied } from "@/components/AdminDenied";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { StatsScreen } from "@/components/StatsScreen";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { todayInTashkent } from "@/lib/admin/showcase/period";
import { cabinetPerson } from "@/lib/admin/person";
import { readSiteNow } from "@/lib/admin/server/siteNow";
import { readSiteStats } from "@/lib/admin/server/stats";
import { requireSection } from "@/lib/admin/session";
import { statsPeriodOf } from "@/lib/stats/period";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/**
 * «Статистика сайта» (фаза 6, мокап CabStats) — только руководитель. Период — в адресе
 * (?per=today|7|30|month|custom&from&to); сбой чтения не закрывает кабинет: управление остаётся,
 * вместо цифр — «не прочиталась».
 */
export default async function StatsPage({ searchParams }: PageProps<"/admin/statistika">) {
  const { viewer, allowed } = await requireSection("stats");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");
  const topbar = (
    <AdminTopbar title={t("stats.title")} subtitle={t("stats.subtitle")} person={person} />
  );
  if (!allowed) {
    return (
      <AdminPage topbar={topbar}>
        <AdminDenied section={t("nav.stats")} />
      </AdminPage>
    );
  }
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPage topbar={topbar}>
        <AdminPanel title={t("stats.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
      </AdminPage>
    );
  }
  const today = todayInTashkent();
  const period = statsPeriodOf(await searchParams, today);
  const supabase = await createSupabaseServerClient();
  const [stats, siteNow] = await Promise.all([
    readSiteStats(supabase, period).catch(() => null),
    readSiteNow(supabase).catch(() => null),
  ]);
  return (
    <AdminPage topbar={topbar}>
      <StatsScreen stats={stats} period={period} today={today} siteNow={siteNow} />
    </AdminPage>
  );
}
