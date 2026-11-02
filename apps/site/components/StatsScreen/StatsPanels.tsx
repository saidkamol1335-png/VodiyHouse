import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { conversion, formatStatsCount, formatStatsPercent, statsBars } from "@/lib/stats/numbers";
import { statsChannel, visitorsByChannel } from "@/lib/stats/sources";
import type { SiteStats } from "@/lib/stats/types";
import { StatsBars, type StatsBarRow } from "./StatsBars";

const CREATIVES_SHOWN = 8;

/** Строки базы → полосы с подписями: доля — от суммы, ширина — от самой длинной. */
function barRows<K extends string>(
  rows: { key: K; value: number }[],
  label: (key: K) => string,
): StatsBarRow[] {
  return statsBars(rows).map((bar) => ({
    key: bar.key,
    label: label(bar.key),
    value: formatStatsCount(bar.value),
    share: `${bar.share}%`,
    width: bar.width,
  }));
}

/** «Источники», «Устройства и язык», «Типы заявок» — три панели в ряд (мокап CabStats .grid3). */
export async function StatsBreakdown({ stats }: { stats: SiteStats }) {
  const t = await getTranslations("admin.stats");
  const tLeads = await getTranslations("admin.leads");
  const sources = barRows(visitorsByChannel(stats.sources), (key) => t(`sources.${key}`));
  const devices = barRows(
    stats.devices.map((row) => ({ key: row.device, value: row.visitors })),
    (key) => t(`devices.${key}`),
  );
  const langs = barRows(
    stats.langs.map((row) => ({ key: row.lang, value: row.visitors })),
    (key) => t(`devices.${key}`),
  );
  const leadTypes = barRows(
    stats.lead_types.map((row) => ({ key: row.type, value: row.leads })),
    (key) => tLeads(`types.${key}`),
  );
  return (
    <div className="stats-screen__grid stats-screen__grid--three">
      <AdminPanel title={t("sources.title")} wide>
        <StatsBars rows={sources} empty={t("empty")} />
      </AdminPanel>
      <AdminPanel title={t("devices.title")} wide>
        <StatsBars rows={devices} empty={t("empty")} />
        {langs.length > 0 ? <hr className="stats-screen__divider" /> : null}
        {langs.length > 0 ? <StatsBars rows={langs} empty="" /> : null}
      </AdminPanel>
      <AdminPanel title={t("leadTypes.title")} wide>
        <StatsBars rows={leadTypes} empty={t("empty")} />
      </AdminPanel>
    </div>
  );
}

/** «Путь посетителя» (мокап): посетители → страница ЖК → планировки → телефон / Telegram → заявка; доля — от посетителей. */
export async function StatsFunnel({ stats }: { stats: SiteStats }) {
  const t = await getTranslations("admin.stats.funnel");
  const { totals } = stats;
  const steps = [
    ["visitors", totals.visitors],
    ["complex", totals.complex_visitors],
    ["layouts", totals.layout_visitors],
    ["contacts", totals.contacts],
    ["leads", totals.leads],
  ] as const;
  const rows: StatsBarRow[] = steps.map(([key, value]) => ({
    key,
    label: t(key),
    value: formatStatsCount(value),
    share: `${formatStatsPercent(conversion(value, totals.visitors) ?? 0)}%`,
    width: totals.visitors > 0 ? Math.min(100, (value / totals.visitors) * 100) : 0,
  }));
  return (
    <AdminPanel title={t("title")} wide>
      <StatsBars
        rows={totals.visitors > 0 ? rows : []}
        empty={(await getTranslations("admin.stats"))("empty")}
        wide
      />
    </AdminPanel>
  );
}

const capitalize = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** «Рекламные креативы · UTM» (мокап): utm_content, канал «Instagram · Reels», посетители, заявки, конверсия. */
export async function StatsCreatives({ stats }: { stats: SiteStats }) {
  const t = await getTranslations("admin.stats");
  const rows = stats.creatives.slice(0, CREATIVES_SHOWN);
  const heads = ["visitors", "leads", "conversion"] as const;
  return (
    <AdminPanel title={t("creatives.title")} wide>
      {rows.length === 0 ? (
        <p className="stats-screen__empty">{t("creatives.empty")}</p>
      ) : (
        <div className="stats-table">
          <table className="stats-table__table">
            <thead>
              <tr>
                <th scope="col">{t("creatives.content")}</th>
                {heads.map((key) => (
                  <th key={key} scope="col" className="stats-table__num">
                    {t(`creatives.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <CreativeRow key={row.content} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPanel>
  );
}

async function CreativeRow({ row }: { row: SiteStats["creatives"][number] }) {
  const t = await getTranslations("admin.stats");
  const rate = conversion(row.leads, row.visitors);
  const channel = [
    row.source ? t(`sources.${statsChannel(row.source)}`) : null,
    row.medium ? capitalize(row.medium) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <tr>
      <td>
        <b className="stats-table__mark">{row.content}</b>
        <span className="stats-table__sub">{channel}</span>
      </td>
      <td className="stats-table__num">{formatStatsCount(row.visitors)}</td>
      <td className="stats-table__num">{formatStatsCount(row.leads)}</td>
      <td className="stats-table__num stats-table__mono">
        {rate === null ? "—" : `${formatStatsPercent(rate)}%`}
      </td>
    </tr>
  );
}
