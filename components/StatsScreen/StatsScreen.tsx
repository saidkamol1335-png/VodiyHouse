import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { SiteNowPanel } from "@/components/SiteNowPanel";
import { StatsChart } from "@/components/StatsChart";
import { readSiteNowAction } from "@/lib/admin/actions/siteNow";
import type { SiteNow } from "@/lib/admin/home/siteNow";
import { formatTime } from "@/lib/format";
import { daysIn, type StatsPeriod } from "@/lib/stats/period";
import type { SiteStats } from "@/lib/stats/types";
import { StatsKpis } from "./StatsKpis";
import { StatsObjects } from "./StatsObjects";
import { StatsBreakdown, StatsCreatives, StatsFunnel } from "./StatsPanels";
import { StatsToolbar } from "./StatsToolbar";

type StatsScreenProps = {
  /** null — site_stats не прочиталась: управление остаётся, вместо цифр — «не прочиталась». */
  stats: SiteStats | null;
  period: StatsPeriod;
  today: string;
  siteNow: SiteNow | null;
};

/** «2026-10-20» → «20.10.2026». */
const dayText = (day: string) => day.split("-").reverse().join(".");

/** Строка под периодами: «20.09.2026 — 19.10.2026 · 30 дней · сравнение с …» или «Сегодня, … данные до …». */
async function PeriodLine({ stats, isToday }: { stats: SiteStats; isToday: boolean }) {
  const t = await getTranslations("admin.stats");
  const range = {
    from: dayText(stats.from),
    to: dayText(stats.to),
    days: daysIn(stats.from, stats.to),
  };
  const today = { date: dayText(stats.from), time: formatTime(new Date(stats.until)) };
  const text = isToday
    ? t(stats.prev_has_data ? "today" : "todayNoPrev", today)
    : stats.prev_has_data
      ? t("rangeCompare", {
          ...range,
          prevFrom: dayText(stats.prev_from),
          prevTo: dayText(stats.prev_to),
        })
      : t("rangeNoPrev", range);
  return <p className="stats-screen__period">{text}</p>;
}

/**
 * «Статистика сайта» руководителя (мокап CabStats): периоды, 6 цифр, график, источники, устройства
 * и язык, типы заявок, популярные ЖК, креативы, путь посетителя и «Сейчас на сайте».
 */
export async function StatsScreen({ stats, period, today, siteNow }: StatsScreenProps) {
  const t = await getTranslations("admin.stats");
  // «Сегодня» — только сегодняшний день: один прошедший день тоже по часам, но со своим текстом.
  const isToday = !!stats && stats.from === today && stats.to === today;
  return (
    <div className="stats-screen">
      <StatsToolbar period={period} today={today} online={siteNow?.online ?? null} />
      {stats ? (
        <>
          <PeriodLine stats={stats} isToday={isToday} />
          <StatsKpis stats={stats} isToday={isToday} />
          <StatsChart
            series={stats.series}
            hourly={stats.hourly}
            isToday={isToday}
            hasPrev={stats.prev_has_data}
          />
          <StatsBreakdown stats={stats} />
          <div className="stats-screen__grid">
            <StatsObjects complexes={stats.complexes} developers={stats.developers} />
            <StatsCreatives stats={stats} />
          </div>
        </>
      ) : (
        <AdminPanel title={t("title")}>{t("unavailable")}</AdminPanel>
      )}
      <div className="stats-screen__grid">
        {stats ? <StatsFunnel stats={stats} /> : null}
        <SiteNowPanel initial={siteNow} read={readSiteNowAction} siteHref="/" />
      </div>
    </div>
  );
}
