import { Eye, Inbox, Layers, Phone, TrendingUp, Users } from "lucide-react";
import { getTranslations } from "next-intl/server";
import {
  conversion,
  formatStatsCount,
  formatStatsPercent,
  statsDelta,
  type StatsDelta,
} from "@/lib/stats/numbers";
import type { SiteStats } from "@/lib/stats/types";

const ICONS = {
  visitors: Users,
  visits: Eye,
  views: Layers,
  leads: Inbox,
  conversion: TrendingUp,
  contacts: Phone,
} as const;
type KpiKey = keyof typeof ICONS;

type KpiCard = [KpiKey, string, StatsDelta];

/** Цифры и изменения: изменение конверсии — от точных долей (мокап), округлённые 1,0% и 1,0% скрыли бы +9,5%. */
function kpiCards({ totals, prev, prev_has_data: hasPrev }: SiteStats): KpiCard[] {
  const share = (part: number, whole: number) => (whole > 0 ? part / whole : 0);
  const count = (key: "visitors" | "visits" | "views" | "leads" | "contacts"): KpiCard => [
    key,
    formatStatsCount(totals[key]),
    statsDelta(totals[key], prev[key], hasPrev),
  ];
  const conversionCard: KpiCard = [
    "conversion",
    `${formatStatsPercent(conversion(totals.leads, totals.visitors) ?? 0)}%`,
    statsDelta(share(totals.leads, totals.visitors), share(prev.leads, prev.visitors), hasPrev),
  ];
  return [
    count("visitors"),
    count("visits"),
    count("views"),
    count("leads"),
    conversionCard,
    count("contacts"),
  ];
}

/** Шесть цифр периода (мокап CabStats .kpis) с изменением к прошлому периоду той же длины. */
export async function StatsKpis({ stats, isToday }: { stats: SiteStats; isToday: boolean }) {
  const t = await getTranslations("admin.stats");
  const suffix = isToday ? "Today" : "";
  const deltaText = (delta: StatsDelta) =>
    delta.kind === "none" || delta.kind === "flat"
      ? t(`delta.${delta.kind}${suffix}`)
      : t(`delta.${delta.kind}${suffix}`, { percent: formatStatsPercent(delta.percent) });
  return (
    <ul className="stats-screen__kpis">
      {kpiCards(stats).map(([key, value, delta]) => {
        const Icon = ICONS[key];
        return (
          <li key={key} className="stats-screen__kpi">
            <span className="stats-screen__kpi-label">
              <Icon size={14} aria-hidden="true" />
              {t(`kpi.${key}`)}
            </span>
            <b className="stats-screen__kpi-value">{value}</b>
            <span className={`stats-screen__kpi-delta stats-screen__kpi-delta--${delta.kind}`}>
              {deltaText(delta)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
