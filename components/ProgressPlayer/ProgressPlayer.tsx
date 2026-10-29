"use client";

import { Pause, Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import { formatDate, formatMonthYear } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl, progressVideoPublicUrl } from "@/lib/media";
import type { ProgressReport } from "@/lib/site/progress/records";
import { useFocusWhen } from "@/lib/ui/useFocusWhen";

type ProgressPlayerProps = {
  report: ProgressReport;
  /** Подпись поверх кадра (мокап .player__cap) — на 1440; на телефоне её нет, комментарий — под плеером. */
  caption?: boolean;
  /** Штамп справа сверху: «Видео за октябрь 2026» (раздел ЖК) или «Видео этой квартиры» (страница видео). */
  label?: string;
};

/** Кадр слайд-шоу фото — каждые 3,5 с (мокап: смена кадра 3.5 s, кроссфейд 1.1 s). */
const FRAME_MS = 3500;
const posterOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const playerOf = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

/**
 * Плеер отчёта хода строительства (мокап .player): уголки видоискателя, штамп «дата · блок» и
 * «Видео за …». Видео — ролик YouTube (плеер только по нажатию, ТЗ 7.5) или файл MP4 (preload="none",
 * постер — первое фото); без видео — слайд-шоу фото отчёта, как кадры мокапа.
 */
export function ProgressPlayer({ report, caption = true, label }: ProgressPlayerProps) {
  const t = useTranslations("complex.progress");
  const locale = useLocale() as Locale;
  const month = formatMonthYear(report.month, locale);
  const stamp = [
    formatDate(new Date(report.shotAt)),
    report.block ? t("block", { name: report.block.name }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const kind = report.youtubeId ? "youtube" : report.videoPath ? "file" : "photos";
  return (
    <figure className={`progress-player progress-player--${kind}`}>
      {kind === "youtube" ? (
        <YoutubeMedia youtubeId={report.youtubeId!} title={t("play", { month })} />
      ) : null}
      {kind === "file" ? <FileMedia report={report} /> : null}
      {kind === "photos" ? <Slideshow report={report} label={t("play", { month })} /> : null}
      <span className="progress-player__corners" aria-hidden="true" />
      <span className="progress-player__stamp progress-player__stamp--start">
        <i aria-hidden="true" />
        {stamp}
      </span>
      <span className="progress-player__stamp progress-player__stamp--end">
        {label ?? t(kind === "photos" ? "stampPhotos" : "stampVideo", { month })}
      </span>
      {caption ? (
        <figcaption className="progress-player__caption">{report.comment[locale]}</figcaption>
      ) : null}
    </figure>
  );
}

function YoutubeMedia({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const player = useFocusWhen<HTMLIFrameElement>(playing);
  if (playing) {
    return (
      <iframe
        ref={player}
        className="progress-player__media"
        src={playerOf(youtubeId)}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }
  return (
    <button
      type="button"
      className="progress-player__poster"
      aria-label={title}
      onClick={() => setPlaying(true)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- превью YouTube, не из бакета */}
      <img
        className="progress-player__media"
        src={posterOf(youtubeId)}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="progress-player__play" aria-hidden="true">
        <Play size={26} fill="currentColor" />
      </span>
    </button>
  );
}

function FileMedia({ report }: { report: ProgressReport }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const poster = report.photos[0];
  return (
    <video
      key={report.id}
      className="progress-player__media"
      src={progressVideoPublicUrl(supabaseUrl, report.videoPath!)}
      poster={poster ? mediaPublicUrl(supabaseUrl, poster.path) : undefined}
      preload="none"
      controls
      playsInline
    />
  );
}

/**
 * Фото отчёта по очереди: «Смотреть» запускает смену кадров, «Пауза» — останавливает. Новый отчёт —
 * новый плеер (key у ProgressPlayer): кадр и пауза начинаются заново.
 */
function Slideshow({ report, label }: { report: ProgressReport; label: string }) {
  const locale = useLocale() as Locale;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const total = report.photos.length;
  useEffect(() => {
    if (!playing || total < 2) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % total), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [playing, total]);
  return (
    <div
      className={
        playing
          ? "progress-player__slides progress-player__slides--playing"
          : "progress-player__slides"
      }
    >
      <Frames report={report} frame={frame} alt={report.comment[locale]} />
      {playing ? null : (
        <button
          type="button"
          className="progress-player__poster"
          aria-label={label}
          onClick={() => setPlaying(true)}
        >
          <span className="progress-player__play" aria-hidden="true">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      )}
      <SlideshowBar
        frame={frame}
        total={total}
        playing={playing}
        onToggle={() => setPlaying((value) => !value)}
      />
    </div>
  );
}

/** Кадры стопкой: виден текущий (смена — opacity, см. CSS), диктор слышит только его. */
function Frames({ report, frame, alt }: { report: ProgressReport; frame: number; alt: string }) {
  return report.photos.map((photo, index) => (
    <SitePhoto
      key={photo.path}
      photo={photo}
      alt={index === frame ? alt : ""}
      frame="cover"
      sizes="(max-width: 760px) 100vw, 860px"
      className={
        index === frame
          ? "progress-player__frame progress-player__frame--active"
          : "progress-player__frame"
      }
    />
  ));
}

type SlideshowBarProps = { frame: number; total: number; playing: boolean; onToggle: () => void };

/** Стеклянная полоса снизу (мокап .player__bar): пауза / смотреть, трек кадров, «2 / 5». */
function SlideshowBar({ frame, total, playing, onToggle }: SlideshowBarProps) {
  const t = useTranslations("complex.progress");
  return (
    <div className="progress-player__bar">
      <button
        type="button"
        className="progress-player__toggle"
        aria-label={playing ? t("pause") : t("resume")}
        onClick={onToggle}
      >
        {playing ? (
          <Pause size={14} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={14} fill="currentColor" aria-hidden="true" />
        )}
      </button>
      <span className="progress-player__track" aria-hidden="true">
        <span
          className="progress-player__fill"
          style={{ transform: `scaleX(${(frame + 1) / Math.max(total, 1)})` }}
        />
      </span>
      <span className="progress-player__count" aria-label={t("frame", { n: frame + 1, total })}>
        {frame + 1} / {total}
      </span>
    </div>
  );
}
