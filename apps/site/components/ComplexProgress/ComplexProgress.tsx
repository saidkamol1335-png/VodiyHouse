"use client";

import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, useId, useMemo, useState } from "react";
import { ProgressPlayer } from "@/components/ProgressPlayer";
import { type FolderSheet, ProgressFolder } from "@/components/ProgressFolder";
import { SitePhoto } from "@/components/SitePhoto";
import { formatDate, formatMonthYear } from "@vh/shared/format";
import type { Locale } from "@/lib/i18n/routing";
import { type ProgressMonth, progressMonthsFrom } from "@/lib/site/progress/months";
import type { ProgressBlock, ProgressReport } from "@/lib/site/progress/records";

type ComplexProgressProps = { reports: readonly ProgressReport[] };

/** Что стоит в плеере: отчёт месяца и его видео или фото с кадра frame. */
type Pick = { month: string; reportId: string; view: "auto" | "photos"; frame: number };

/**
 * «Ход строительства» (фаза 5, мокап .prog; с 03.11.2026 — папками месяцев): папка на месяц, нажатие
 * открывает его — плеер отчёта, комментарий и «Снято …», справа готовность блока и все материалы
 * месяца (видео и каждое фото — плиткой, нажатие ставит материал в плеер). Открыта всегда одна папка
 * — самая новая по умолчанию: раздел не схлопывается, ссылка с главной сразу видит плеер.
 */
export function ComplexProgress({ reports }: ComplexProgressProps) {
  const t = useTranslations("complex.progress");
  const locale = useLocale() as Locale;
  const panelId = useId();
  const months = useMemo(() => progressMonthsFrom(reports), [reports]);
  const first = months[0];
  const [pick, setPick] = useState<Pick | null>(null);
  const [chosen, setChosen] = useState(false);
  const month = months.find((item) => item.month === pick?.month) ?? first;
  const current = month?.reports.find((report) => report.id === pick?.reportId) ?? month?.reports[0];
  if (!month || !current) return null;
  const choose = (next: Pick) => {
    setChosen(true);
    setPick(next);
  };
  const openMonth = (item: ProgressMonth) =>
    choose({ month: item.month, reportId: item.reports[0]?.id ?? "", view: "auto", frame: 0 });
  const view = pick?.month === month.month ? pick : { month: month.month, reportId: current.id, view: "auto" as const, frame: 0 };
  return (
    <div className="complex-progress">
      <div className="complex-progress__main">
        <FolderRow months={months} open={month.month} locale={locale} panelId={panelId} onOpen={openMonth} onSheet={choose} />
        <div id={panelId} key={month.month} className={chosen ? "complex-progress__panel complex-progress__panel--enter" : "complex-progress__panel"}>
          <ProgressPlayer
            key={`${current.id}:${view.view}:${view.frame}`}
            report={current}
            mode={view.view === "photos" ? "photos" : undefined}
            initialFrame={view.frame}
          />
          <p className="complex-progress__comment">{current.comment[locale]}</p>
          <p className="complex-progress__shot">{t("shot", { date: formatDate(new Date(current.shotAt)) })}</p>
        </div>
      </div>
      <div className="complex-progress__side">
        {current.block ? <BlockReadiness block={current.block} /> : null}
        <MonthContents key={month.month} month={month} view={view} locale={locale} onPick={choose} enter={chosen} />
      </div>
    </div>
  );
}

type FolderRowProps = {
  months: readonly ProgressMonth[];
  open: string;
  locale: Locale;
  panelId: string;
  onOpen: (month: ProgressMonth) => void;
  onSheet: (pick: Pick) => void;
};

/** Ключ листа: «отчёт:v» — видео, «отчёт:кадр» — фото; по ключу лист ставится в плеер. */
function pickOf(month: ProgressMonth, key: string): Pick | null {
  const [reportId = "", part = ""] = key.split(":");
  if (!month.reports.some((report) => report.id === reportId)) return null;
  return part === "v" ? { month: month.month, reportId, view: "auto", frame: 0 } : { month: month.month, reportId, view: "photos", frame: Number(part) };
}

/** Листы папки: видео и фото месяца, подпись — что это, мета — дата съёмки. */
function useSheetsOf() {
  const t = useTranslations("complex.progress");
  const locale = useLocale() as Locale;
  return (month: ProgressMonth): FolderSheet[] =>
    month.reports.flatMap((report) => {
      const date = formatDate(new Date(report.shotAt));
      const video = report.youtubeId || report.videoPath;
      const head: FolderSheet[] = video ? [{ key: `${report.id}:v`, name: t("itemVideo", { month: formatMonthYear(month.month, locale) }), meta: date, photo: report.photos[0] ?? null }] : [];
      return [...head, ...report.photos.map((photo, frame) => ({ key: `${report.id}:${frame}`, name: t("itemPhoto", { n: frame + 1, total: report.photos.length }), meta: date, photo }))];
    });
}

/** Ряд папок (role=group «Месяцы отчётов», как были чипы): Glassmorphism Folder Cards один в один. */
function FolderRow({ months, open, locale, panelId, onOpen, onSheet }: FolderRowProps) {
  const t = useTranslations("complex.progress");
  const sheetsOf = useSheetsOf();
  const metaOf = (month: ProgressMonth) =>
    [month.photos ? t("photos", { n: month.photos }) : null, month.videos ? t("videos", { n: month.videos }) : null]
      .filter(Boolean)
      .join(" · ");
  return (
    <div className="complex-progress__months" role="group" aria-label={t("months")}>
      {months.map((month, index) => (
        <ProgressFolder
          key={month.month}
          label={formatMonthYear(month.month, locale)}
          meta={metaOf(month)}
          cover={month.peek[0] ?? null}
          sheets={sheetsOf(month)}
          selected={month.month === open}
          index={index}
          panelId={panelId}
          onPick={() => onOpen(month)}
          onSheet={(key) => {
            const pick = pickOf(month, key);
            if (pick) onSheet(pick);
          }}
        />
      ))}
    </div>
  );
}

type MonthContentsProps = {
  month: ProgressMonth;
  view: Pick;
  locale: Locale;
  enter: boolean;
  onPick: (pick: Pick) => void;
};

/** Все материалы открытого месяца: видео отчёта и каждое фото — плиткой; выбранное — в плеере. */
function MonthContents({ month, view, locale, enter, onPick }: MonthContentsProps) {
  const t = useTranslations("complex.progress");
  const label = formatMonthYear(month.month, locale);
  const many = month.reports.length > 1;
  const tiles = month.reports.flatMap((report) => {
    const block = many && report.block ? ` · ${t("block", { name: report.block.name })}` : "";
    const video = report.youtubeId || report.videoPath;
    const items = video ? [{ key: `${report.id}:v`, report, photos: false, frame: 0, name: `${t("itemVideo", { month: label })}${block}` }] : [];
    return [
      ...items,
      ...report.photos.map((photo, frame) => ({
        key: `${report.id}:${photo.path}`,
        report,
        photos: true,
        frame,
        name: `${t("itemPhoto", { n: frame + 1, total: report.photos.length })}${block}`,
      })),
    ];
  });
  if (tiles.length < 2) return null;
  return (
    <ul className={enter ? "complex-progress__thumbs complex-progress__thumbs--enter" : "complex-progress__thumbs"} aria-label={t("contents", { month: label })}>
      {tiles.map((tile, index) => {
        const pressed = view.reportId === tile.report.id && (tile.photos ? view.view === "photos" && view.frame === tile.frame : view.view === "auto");
        return (
          <li key={tile.key} style={{ "--n": index } as CSSProperties}>
            <button
              type="button"
              className="complex-progress__thumb"
              aria-pressed={pressed}
              aria-label={tile.name}
              onClick={() => onPick({ month: month.month, reportId: tile.report.id, view: tile.photos ? "photos" : "auto", frame: tile.frame })}
            >
              <TileImage report={tile.report} frame={tile.frame} video={!tile.photos} />
              <span className="complex-progress__thumb-label">{tile.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Кадр плитки: фото отчёта; у видео — его первое фото с ▶ (без запросов к YouTube до нажатия). */
function TileImage({ report, frame, video }: { report: ProgressReport; frame: number; video: boolean }) {
  const photo = report.photos[video ? 0 : frame];
  return (
    <span className="complex-progress__thumb-photo">
      {photo ? <SitePhoto photo={photo} alt="" frame="card" sizes="(max-width: 760px) 128px, 160px" className="complex-progress__thumb-image" /> : null}
      {video ? <Play size={18} fill="currentColor" aria-hidden="true" className="complex-progress__thumb-play" /> : null}
    </span>
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
        <p className="complex-progress__ready-floors">
          {t("floors", { built: block.floorsBuilt, total: block.floorsTotal })}
        </p>
      ) : null}
    </div>
  );
}
