"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { ProgressPlayer } from "@/components/ProgressPlayer";
import { SitePhoto } from "@/components/SitePhoto";
import { formatDate, formatMonthYear } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { ProgressReport, UnitVideo } from "@/lib/site/progress/records";

type UnitVideoReportsProps = {
  video: UnitVideo;
  /** Правая колонка (мокап .vp__grid 1fr 300px): готовность блока и «Хотите посмотреть вживую?». */
  aside: ReactNode;
};

/**
 * Плеер видео квартиры и под ним — «Снято …», «Что сделано за месяц», «Предыдущие месяцы» (мокап
 * SiteVideo / MobVideo). Нажатие на прошлый месяц ставит его отчёт в плеер; адрес страницы не меняется.
 */
export function UnitVideoReports({ video, aside }: UnitVideoReportsProps) {
  const t = useTranslations("unitVideo");
  const locale = useLocale() as Locale;
  const reports = [video, ...video.history];
  const [currentId, setCurrentId] = useState(video.id);
  const current = reports.find((report) => report.id === currentId) ?? video;
  const label = current.isUnit
    ? t("levelUnit")
    : current.block
      ? t("levelBlock", { name: current.block.name })
      : t("levelComplex");
  return (
    <>
      <ProgressPlayer key={current.id} report={current} label={label} />
      <div className="unit-video__grid">
        <div className="unit-video__main">
          <section className="unit-video__card">
            <p className="unit-video__label">
              {t("shot", { date: formatDate(new Date(current.shotAt)) })}
            </p>
            <h2 className="unit-video__card-title">{t("done")}</h2>
            <p className="unit-video__comment">{current.comment[locale]}</p>
          </section>
          {video.history.length > 0 ? (
            <History reports={reports} currentId={current.id} onPick={setCurrentId} />
          ) : null}
        </div>
        <aside className="unit-video__side">{aside}</aside>
      </div>
    </>
  );
}

type HistoryProps = {
  reports: readonly ProgressReport[];
  currentId: string;
  onPick: (id: string) => void;
};

/** «Предыдущие месяцы» (мокап .vp__hist): превью с месяцем; на телефоне — лентой. */
function History({ reports, currentId, onPick }: HistoryProps) {
  const t = useTranslations("unitVideo");
  const locale = useLocale() as Locale;
  return (
    <section className="unit-video__card">
      <h2 className="unit-video__label">{t("history")}</h2>
      <ul className="unit-video__history">
        {reports.map((report) => (
          <li key={report.id}>
            <button
              type="button"
              className="unit-video__month"
              aria-pressed={report.id === currentId}
              onClick={() => onPick(report.id)}
            >
              {report.photos[0] ? (
                <SitePhoto
                  photo={report.photos[0]}
                  alt=""
                  frame="card"
                  sizes="160px"
                  className="unit-video__month-photo"
                />
              ) : null}
              <span className="unit-video__month-label">
                {formatMonthYear(report.month, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
