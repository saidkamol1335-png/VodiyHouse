"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  chartLabelIndexes,
  chartPaths,
  chartX,
  chartY,
  type ChartPaths,
} from "@/lib/stats/chart";
import { formatStatsAxis } from "@/lib/stats/numbers";
import type { StatsMetric, StatsPoint } from "@/lib/stats/types";

const METRICS: readonly StatsMetric[] = ["visitors", "visits", "views", "leads"];
const GRID = Array.from(
  { length: 5 },
  (_, index) => `M0,${CHART_HEIGHT - index * 75}H${CHART_WIDTH}`,
).join("");

type StatsChartProps = {
  series: StatsPoint[];
  hourly: boolean;
  /** Сегодня: «· сегодня» и «вчера» вместо «выбранный период» и «прошлый период». */
  isToday: boolean;
  /** Есть прошлый период — пунктир и «прошлый период: N» в подсказке. */
  hasPrev: boolean;
};

const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });
const pad = (value: number) => String(value).padStart(2, "0");
/** «2026-10-20» → «20.10». */
const dayMonth = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
/** «2026-10-20» → «Пн, 20.10.2026» (мокап: подсказка графика). */
function weekdayDate(day: string): string {
  const weekday = WEEKDAY.format(new Date(`${day}T12:00:00Z`));
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day.split("-").reverse().join(".")}`;
}

/**
 * График «Статистики сайта» (мокап CabStats): вкладки метрик, линия и заливка периода, пунктир
 * прошлого, подсказка при наведении и стрелками с клавиатуры. Без анимации — только показ подсказки.
 */
export function StatsChart({ series, hourly, isToday, hasPrev }: StatsChartProps) {
  const t = useTranslations("admin.stats");
  const [metric, setMetric] = useState<StatsMetric>("visitors");
  const current = series.map((point) => (point.cur ? point.cur[metric] : null));
  const previous = hasPrev ? series.map((point) => point.prev[metric]) : null;
  const paths = chartPaths(current, previous);
  const hover = useChartHover(current);
  const metricName = t(`metrics.${metric}`);
  const tip = { series, hourly, isToday, metric, top: paths.top, hasPrev };
  const pick = (next: StatsMetric) => {
    setMetric(next);
    hover.clear();
  };
  return (
    <section
      className="stats-chart"
      aria-label={t("chartLabel", { metric: metricName, unit: hourly ? "hour" : "day" })}
    >
      <ChartHead metric={metric} onPick={pick} isToday={isToday} hasPrev={previous !== null} />
      <div className="stats-chart__box" onMouseLeave={hover.clear}>
        <ChartAxisY top={paths.top} />
        <div
          className="stats-chart__plot"
          tabIndex={0}
          role="group"
          aria-label={t("chartKeys")}
          onKeyDown={hover.onKey}
          onBlur={hover.clear}
        >
          <ChartLines paths={paths} />
          {hover.shown !== null ? <ChartTip index={hover.shown} {...tip} /> : null}
          <div className="stats-chart__hits" aria-hidden="true">
            {series.map((point, index) => (
              <div key={`${point.day}-${point.hour}`} onMouseEnter={() => hover.set(index)} />
            ))}
          </div>
        </div>
        <ChartAxisX series={series} hourly={hourly} />
      </div>
    </section>
  );
}

type ChartHeadProps = {
  metric: StatsMetric;
  onPick: (metric: StatsMetric) => void;
  isToday: boolean;
  hasPrev: boolean;
};

/** Вкладки метрик и легенда: «Посетители · выбранный период», пунктир «прошлый период» (сегодня — «вчера»). */
function ChartHead({ metric, onPick, isToday, hasPrev }: ChartHeadProps) {
  const t = useTranslations("admin.stats");
  return (
    <div className="stats-chart__head">
      <Segmented label={t("metricsLabel")}>
        {METRICS.map((key) => (
          <button
            key={key}
            type="button"
            className={segmentedItemClass(key === metric)}
            aria-pressed={key === metric}
            onClick={() => onPick(key)}
          >
            {t(`metrics.${key}`)}
          </button>
        ))}
      </Segmented>
      <div className="stats-chart__legend">
        <span className="stats-chart__key">
          {t(isToday ? "legendToday" : "legendCurrent", { metric: t(`metrics.${metric}`) })}
        </span>
        {hasPrev ? (
          <span className="stats-chart__key stats-chart__key--prev">
            {t(isToday ? "legendYesterday" : "legendPrev")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Точка под мышью или стрелками ← →; не наступивший час не подсвечивается. */
function useChartHover(current: readonly (number | null)[]) {
  const [hover, setHover] = useState<number | null>(null);
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const last = current.findLastIndex((value) => value !== null);
    if (!step || last < 0) return;
    event.preventDefault();
    setHover((index) => Math.min(Math.max((index ?? (step > 0 ? -1 : last + 1)) + step, 0), last));
  };
  const shown = hover !== null && current[hover] != null ? hover : null;
  return { shown, set: setHover, clear: () => setHover(null), onKey };
}

/** Поле 1000 × 300: сетка, заливка и линия периода, пунктир прошлого. */
function ChartLines({ paths }: { paths: ChartPaths }) {
  const gradient = useId();
  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="stats-chart__stop" />
          <stop offset="1" className="stats-chart__stop stats-chart__stop--end" />
        </linearGradient>
      </defs>
      <path className="stats-chart__grid" d={GRID} />
      {paths.area ? (
        <path className="stats-chart__area" d={paths.area} fill={`url(#${gradient})`} />
      ) : null}
      {paths.prev ? <path className="stats-chart__prev" d={paths.prev} /> : null}
      {paths.line ? <path className="stats-chart__line" d={paths.line} /> : null}
    </svg>
  );
}

/** Ось Y: 0 и четыре круглых шага (мокап); шаг 2,5 — с дробью, иначе «3» и «8» не на своих линиях. */
function ChartAxisY({ top }: { top: number }) {
  return [0, 1, 2, 3, 4].map((index) => (
    <span
      key={index}
      className="stats-chart__y"
      aria-hidden="true"
      style={{ "--y": 1 - index / 4 } as CSSProperties}
    >
      {formatStatsAxis((top / 4) * index)}
    </span>
  ));
}

/** Ось X: «20.10» по дням или «08:00» по часам, до 7 меток. */
function ChartAxisX({ series, hourly }: { series: StatsPoint[]; hourly: boolean }) {
  const count = series.length;
  const label = (index: number) =>
    hourly ? `${pad(series[index]!.hour)}:00` : dayMonth(series[index]!.day);
  return (
    <div className="stats-chart__x" aria-hidden="true">
      {chartLabelIndexes(count, hourly).map((index) => (
        <span key={index} style={{ "--x": `${chartX(index, count) / 10}%` } as CSSProperties}>
          {label(index)}
        </span>
      ))}
    </div>
  );
}

type ChartTipProps = {
  index: number;
  series: StatsPoint[];
  hourly: boolean;
  isToday: boolean;
  metric: StatsMetric;
  top: number;
  hasPrev: boolean;
};

/** Крестик, точка и подсказка: «312 · посетители», «Пн, 20.10.2026», «прошлый период: 280». */
function ChartTip({ index, series, hourly, isToday, metric, top, hasPrev }: ChartTipProps) {
  const t = useTranslations("admin.stats");
  const point = series[index]!;
  const value = point.cur?.[metric] ?? 0;
  const x = chartX(index, series.length) / 10;
  const style = { "--x": `${x}%`, "--y": `${chartY(value, top) / 3}%` } as CSSProperties;
  // У краёв подсказка открывается внутрь поля: на 390 по центру точки она вылезала за экран.
  const side = x < 30 ? " stats-chart__tip--start" : x > 70 ? " stats-chart__tip--end" : "";
  return (
    <div className="stats-chart__hover" style={style}>
      <i className="stats-chart__cross" />
      <i className="stats-chart__dot" />
      <div className={`stats-chart__tip${side}`} role="status">
        <b>{t("tipValue", { value, metric: t(`metrics.${metric}`).toLowerCase() })}</b>
        <span>{hourly ? t("tipHour", { hour: pad(point.hour) }) : weekdayDate(point.day)}</span>
        {hasPrev ? (
          <span>{t(isToday ? "tipYesterday" : "tipPrev", { value: point.prev[metric] })}</span>
        ) : null}
      </div>
    </div>
  );
}
