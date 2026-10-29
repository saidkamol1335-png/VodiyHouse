import { io } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminPage } from "@/components/AdminPage";
import { AdminPanel } from "@/components/AdminPanel";
import { AdminTopbar } from "@/components/AdminTopbar";
import { HomeLeadCards, HomeStockLive, LatestLeads, SiteTodayCard } from "@/components/HomeLeads";
import { SiteNowPanel } from "@/components/SiteNowPanel";
import { isCabinetOpenWithoutLogin, type StaffRole } from "@/lib/admin/access";
import { readSiteNowAction } from "@/lib/admin/actions/siteNow";
import { readSiteStockAction } from "@/lib/admin/actions/siteStock";
import { greetingOf } from "@/lib/admin/greeting";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { cabinetPerson, type CabinetPerson } from "@/lib/admin/person";
import { readLeadsHome } from "@/lib/admin/server/leads";
import { readSiteNow } from "@/lib/admin/server/siteNow";
import { readSiteStock } from "@/lib/admin/server/siteStock";
import { readSiteToday } from "@/lib/admin/server/stats";
import { requireSection } from "@/lib/admin/session";
import { formatWeekdayDate } from "@/lib/format";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Страница сама читает сессию (переход между разделами не перерисовывает layout) — и тоже
// ждёт её на сервере: instant = false у layout на страницу не распространяется.
export const instant = false;

type HomeTopbarProps = { person: CabinetPerson; withStock: boolean };

// Приветствие зависит от текущего часа по Ташкенту (К4.3): считается на каждый запрос,
// а в статичной оболочке стоит заглушка той же высоты.
async function HomeTopbar({ person, withStock }: HomeTopbarProps) {
  await io();
  const now = new Date();
  const t = await getTranslations("admin.home");
  const greeting = t(`greeting.${greetingOf(now)}`);
  const title = person.firstName
    ? t("greetingWithName", { greeting, name: person.firstName })
    : greeting;
  const date = formatWeekdayDate(now);
  return (
    <AdminTopbar
      title={title}
      subtitle={withStock ? t("subtitleStock", { date }) : t("subtitle", { date })}
      person={person}
    />
  );
}

export default async function AdminHomePage() {
  // Layout не перерисовывается при переходах — страница проверяет сотрудника сама.
  const { viewer, allowed } = await requireSection("home");
  const person = await cabinetPerson(viewer);
  const t = await getTranslations("admin");

  const topbar = (
    <Suspense fallback={<AdminTopbar title={t("nav.home")} person={person} pending />}>
      <HomeTopbar person={person} withStock={allowed} />
    </Suspense>
  );

  // Главная — руководителю и менеджеру; видеограф до раздела «Видео» видит только заглушку.
  return (
    <AdminPage topbar={topbar}>
      {allowed ? (
        <HomeStock role={viewer.role} />
      ) : (
        <AdminPanel title={t("home.emptyTitle")}>{t("home.roleLater")}</AdminPanel>
      )}
      {isCabinetOpenWithoutLogin ? <p className="admin-page__note">{t("devOnly")}</p> : null}
    </AdminPage>
  );
}

/**
 * Карточки и «Последние заявки» (шаг 3.7, Г1 B), ниже — «Остатки по ЖК» (шаг 13): первые цифры —
 * здесь, дальше панель остатков перечитывает их сама (Г4 A).
 */
async function HomeStock({ role }: { role: StaffRole }) {
  const t = await getTranslations("admin");
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    return (
      <AdminPanel title={t("home.stock.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
    );
  }
  const supabase = await createSupabaseServerClient();
  // Сбой чтения не роняет главную: панель скажет «не прочитались» и прочитает сама.
  // «Сайт сегодня» — только руководителю (мокап CabHome; статистика — его раздел).
  const [initial, leads, now, today] = await Promise.all([
    readSiteStock(supabase).catch(() => null),
    readLeadsHome(supabase).catch(() => null),
    readSiteNow(supabase).catch(() => null),
    role === "head" ? readSiteToday(supabase).catch(() => null) : null,
  ]);
  return (
    <HomeStockLive
      cards={leads ? <HomeLeadCards leads={leads} /> : null}
      after={today !== null ? <SiteTodayCard visitors={today} online={now?.online ?? null} /> : null}
      latest={
        <div className="home-leads__split">
          {leads ? (
            <LatestLeads rows={leads.latest} />
          ) : (
            <AdminPanel title={t("leads.home.latest")}>{t("leads.home.unavailable")}</AdminPanel>
          )}
          <SiteNowPanel initial={now} read={readSiteNowAction} siteHref="/" />
        </div>
      }
      initial={initial}
      read={readSiteStockAction}
      complexesHref={ADMIN_ROUTES.complexes}
    />
  );
}
