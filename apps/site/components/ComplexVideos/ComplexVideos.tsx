"use client";

import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useFocusWhen } from "@/lib/ui/useFocusWhen";
import type { LocalizedText } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";

export type ComplexVideo = { youtubeId: string; title: LocalizedText | null };

type ComplexVideosProps = { videos: readonly ComplexVideo[]; name: string };

/** Превью YouTube — картинка, а не плеер: плеер грузится только по нажатию (ТЗ 7.5). */
const posterOf = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
/** youtube-nocookie: без cookie YouTube до нажатия «Смотреть» (ТЗ 16.6 открыт). */
const playerOf = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;

/**
 * «Видеообзор ЖК» (Ф4, ТЗ 7.5): первое видео крупно, остальные — превью рядом; нажатие на превью
 * ставит его крупно. Плеер YouTube — только после нажатия: страница открывается быстрее.
 */
export function ComplexVideos({ videos, name }: ComplexVideosProps) {
  const t = useTranslations("complex.video");
  const locale = useLocale() as Locale;
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const titleOf = (video: ComplexVideo) => video.title?.[locale] ?? t("fallbackTitle", { name });
  const main = videos[current];
  if (!main) return null;
  return (
    <div className={videos.length > 1 ? "complex-videos" : "complex-videos complex-videos--single"}>
      <div className="complex-videos__main">
        <VideoPlayer youtubeId={main.youtubeId} title={titleOf(main)} playing={playing} onPlay={() => setPlaying(true)} />
        <p className="complex-videos__title">{titleOf(main)}</p>
      </div>
      {videos.length > 1 ? (
        <VideoList
          label={t("list")}
          videos={videos}
          current={current}
          titleOf={titleOf}
          onPick={(index) => {
            setCurrent(index);
            setPlaying(false);
          }}
        />
      ) : null}
    </div>
  );
}

type VideoPlayerProps = { youtubeId: string; title: string; playing: boolean; onPlay: () => void };

/** Обложка с «Смотреть» → плеер YouTube на её месте (фокус переходит на плеер). */
function VideoPlayer({ youtubeId, title, playing, onPlay }: VideoPlayerProps) {
  const t = useTranslations("complex.video");
  const player = useFocusWhen<HTMLIFrameElement>(playing);
  if (playing) {
    return (
      <iframe
        ref={player}
        className="complex-videos__player"
        src={playerOf(youtubeId)}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }
  return (
    <button type="button" className="complex-videos__poster" aria-label={t("play", { title })} onClick={onPlay}>
      {/* eslint-disable-next-line @next/next/no-img-element -- превью YouTube, не из бакета */}
      <img src={posterOf(youtubeId)} alt="" loading="lazy" decoding="async" />
      <span className="complex-videos__play" aria-hidden="true">
        <Play size={26} fill="currentColor" />
      </span>
    </button>
  );
}

type VideoListProps = {
  label: string;
  videos: readonly ComplexVideo[];
  current: number;
  titleOf: (video: ComplexVideo) => string;
  onPick: (index: number) => void;
};

/** Превью остальных видео (ТЗ 7.5 «первое крупно, остальные превью»): нажатие ставит видео крупно. */
function VideoList({ label, videos, current, titleOf, onPick }: VideoListProps) {
  return (
    <ul className="complex-videos__list" aria-label={label}>
      {videos.map((video, index) => (
        <li key={video.youtubeId}>
          <button
            type="button"
            className={index === current ? "complex-videos__thumb complex-videos__thumb--on" : "complex-videos__thumb"}
            aria-pressed={index === current}
            onClick={() => onPick(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- превью YouTube, не из бакета */}
            <img src={posterOf(video.youtubeId)} alt="" loading="lazy" decoding="async" />
            <span>{titleOf(video)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
