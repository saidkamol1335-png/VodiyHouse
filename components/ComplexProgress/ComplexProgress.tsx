"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ProgressPlayer } from "@/components/ProgressPlayer";
import { SitePhoto } from "@/components/SitePhoto";
import { formatDate, formatMonthYear } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { ProgressBlock, ProgressReport } from "@/lib/site/progress/records";

type ComplexProgressProps = { reports: readonly ProgressReport[] };

/** Чипов месяцев — до 6 (мокап: 5 на 1440, 6 на 390; лишний чип на 1440 прячет CSS), превью — до 6. */
const SHOWN = 6;

/**
 * «Ход строительства» (фаза 5, мокап .prog): чипы месяцев, плеер отчёта, комментарий и «Снято …»;
 * справа — готовность блока и превью отчётов. Выбор чипа или превью ставит отчёт в плеер.
 */
export function ComplexProgress({ reports }: ComplexProgressProps) {
  const t = useTranslations("complex.progress");
  const locale = useLocale() as Locale;
  const shown = reports.slice(0, SHOWN);
  const [currentId, setCurrentId] = useState(shown[0]?.id);
  const current = shown.find((report) => report.id === currentId) ?? shown[0];
  if (!current) return null;
  // Два блока в одном месяце — чип с названием блока, иначе два одинаковых «Октябрь 2026».
  const repeated = new Set(shown.map((report) => report.month).filter((month, index, all) => all.indexOf(month) !== index));
  const chipOf = (report: ProgressReport) =>
    [formatMonthYear(report.month, locale), repeated.has(report.month) && report.block ? t("block", { name: report.block.name }) : null]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="complex-progress">
      <div className="complex-progress__main">
        <div className="complex-progress__months" role="group" aria-label={t("months")}>
          {shown.map((report) => (
            <button key={report.id} type="button" className="complex-progress__month" aria-pressed={report.id === current.id} onClick={() => setCurrentId(report.id)}>
              {chipOf(report)}
            </button>
          ))}
        </div>
        <ProgressPlayer key={current.id} report={current} />
        <p className="complex-progress__comment">{current.comment[locale]}</p>
        <p className="complex-progress__shot">{t("shot", { date: formatDate(new Date(current.shotAt)) })}</p>
      </div>
      <div className="complex-progress__side">
        {current.block ? <BlockReadiness block={current.block} /> : null}
        {shown.length > 1 ? <Thumbs reports={shown} currentId={current.id} labelOf={chipOf} onPick={setCurrentId} /> : null}
      </div>
    </div>
  );
}

type ThumbsProps = {
  reports: readonly ProgressReport[];
  currentId: string;
  labelOf: (report: ProgressReport) => string;
  onPick: (id: string) => void;
};

/** Превью отчётов (мокап .vthumbs): сетка 2 × N на 1440, лента на телефоне; нажатие — отчёт в плеер. */
function Thumbs({ reports, currentId, labelOf, onPick }: ThumbsProps) {
  const t = useTranslations("complex.progress");
  return (
    <ul className="complex-progress__thumbs" aria-label={t("thumbs")}>
      {reports.map((report) => (
        <li key={report.id}>
          <button type="button" className="complex-progress__thumb" aria-pressed={report.id === currentId} aria-label={t("play", { month: labelOf(report) })} onClick={() => onPick(report.id)}>
            <Thumb report={report} />
            <span className="complex-progress__thumb-label">{labelOf(report)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** «Готовность блока B · 58% · 7 из 12 этажей» (мокап .ready): без процента в базе карточки нет. */
function BlockReadiness({ block }: { block: ProgressBlock }) {
  const t = useTranslations("complex.progress");
  if (block.progressPct === null) return null;
  return (
    <div className="complex-progress__ready">
      <p className="complex-progress__ready-label">{t("ready", { name: block.name })}</p>
      <p className="complex-progress__ready-value">{block.progressPct}%</p>
      <span className="complex-progress__ready-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${block.progressPct / 100})` }} />
      </span>
      {block.floorsBuilt !== null && block.floorsTotal ? (
        <p className="complex-progress__ready-floors">{t("floors", { built: block.floorsBuilt, total: block.floorsTotal })}</p>
      ) : null}
    </div>
  );
}

function Thumb({ report }: { report: ProgressReport }) {
  const photo = report.photos[0];
  if (photo) return <SitePhoto photo={photo} alt="" frame="card" sizes="(max-width: 760px) 128px, 160px" className="complex-progress__thumb-photo" />;
  if (report.youtubeId) {
    // eslint-disable-next-line @next/next/no-img-element -- превью YouTube, не из бакета
    return <img className="complex-progress__thumb-photo" src={`https://i.ytimg.com/vi/${report.youtubeId}/mqdefault.jpg`} alt="" loading="lazy" decoding="async" />;
  }
  return <span className="complex-progress__thumb-photo" />;
}
