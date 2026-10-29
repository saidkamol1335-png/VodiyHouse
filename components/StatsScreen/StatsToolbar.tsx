import { Download } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import {
  addDays,
  STATS_KEEP_DAYS,
  STATS_PERIODS,
  statsPeriodOf,
  statsPeriodQuery,
  type StatsPeriod,
} from "@/lib/stats/period";
import { StatsOnline } from "./StatsOnline";

type StatsToolbarProps = { period: StatsPeriod; today: string; online: number | null };

/** Адрес кнопки периода: свой период держит выбранные даты, остальные — только ключ. */
function periodHref(key: StatsPeriod["key"], period: StatsPeriod, today: string): string {
  const next =
    key === "custom" && period.key === "custom" ? period : statsPeriodOf({ per: key }, today);
  return `${ADMIN_ROUTES.stats}?${statsPeriodQuery(next)}`;
}

/**
 * Строка управления (мокап CabStats): «Сегодня · 7 дней · 30 дней · Этот месяц · Период…» ссылками
 * (период — в адресе), у «Период…» — две даты формой GET без скриптов; «Онлайн сейчас» и «CSV».
 */
export async function StatsToolbar({ period, today, online }: StatsToolbarProps) {
  const t = await getTranslations("admin.stats");
  return (
    <div className="stats-screen__toolbar">
      <div className="stats-screen__periods">
        <Segmented label={t("periodsLabel")} className="stats-screen__segment">
          {STATS_PERIODS.map((key) => (
            <Link
              key={key}
              href={periodHref(key, period, today)}
              className={segmentedItemClass(key === period.key)}
              aria-current={key === period.key ? "page" : undefined}
            >
              {t(`periods.${key}`)}
            </Link>
          ))}
        </Segmented>
        {period.key === "custom" ? <CustomPeriod period={period} today={today} /> : null}
      </div>
      <div className="stats-screen__tools">
        {online !== null ? <StatsOnline initial={online} /> : null}
        <Button
          variant="outline"
          size="sm"
          href={`${ADMIN_ROUTES.stats}/csv?${statsPeriodQuery(period)}`}
          download
        >
          <Download size={16} aria-hidden="true" />
          {t("csv")}
        </Button>
      </div>
    </div>
  );
}

/** «Период…»: две даты (не раньше хранения событий и не позже сегодня) и «Показать». */
async function CustomPeriod({ period, today }: { period: StatsPeriod; today: string }) {
  const t = await getTranslations("admin.stats");
  const min = addDays(today, -STATS_KEEP_DAYS);
  const field = (name: "from" | "to") => (
    <label className="stats-screen__date">
      <span>{t(name)}</span>
      <input
        className="field__input stats-screen__date-input"
        type="date"
        name={name}
        defaultValue={period[name]}
        min={min}
        max={today}
        required
      />
    </label>
  );
  return (
    <form className="stats-screen__custom" action={ADMIN_ROUTES.stats} method="get">
      <input type="hidden" name="per" value="custom" />
      {field("from")}
      {field("to")}
      <Button variant="outline" size="sm" type="submit">
        {t("apply")}
      </Button>
    </form>
  );
}
