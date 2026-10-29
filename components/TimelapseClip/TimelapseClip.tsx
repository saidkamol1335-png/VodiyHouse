"use client";

import { useRef, type RefObject } from "react";
import { TimelapseToggle, type TimelapseToggleLabels } from "@/components/TimelapseToggle";
import { TIMELAPSE_FRAME, TIMELAPSE_POSTER } from "@/lib/site/timelapse/assets";
import { useTimelapse } from "@/lib/site/timelapse/useTimelapse";

type TimelapseClipProps = {
  /** Класс места: панель «Застройщикам», фон карточки «О нас». */
  className: string;
  /** Ширина блока для выбора постера (атрибут sizes). */
  sizes: string;
  toggleLabels: TimelapseToggleLabels;
};

/**
 * Тот же ролик стройки, что на первом экране главной, — в панели или фоном карточки. Постер «вечер»
 * грузится лениво (не первая картинка страницы); ролик проявляется, когда блок на экране, играет один
 * раз (с паузой кнопкой) и уступает постеру — тот же кадр; в none и при экономии трафика — только постер.
 */
export function TimelapseClip({ className, sizes, toggleLabels }: TimelapseClipProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = useTimelapse({ host: hostRef, video: videoRef, portraitOnPhone: false });

  const classes = ["timelapse-clip", className];
  if (clip.playing) classes.push("timelapse-clip--playing");
  return (
    <div ref={hostRef} className={classes.join(" ")}>
      <ClipMedia sizes={sizes} video={clip.mode === "none" ? null : videoRef} />
      {clip.playing ? (
        <TimelapseToggle
          paused={clip.paused}
          labels={toggleLabels}
          onToggle={clip.toggle}
          className="timelapse-clip__toggle"
        />
      ) : null}
    </div>
  );
}

/** Постер и ролик — украшение, для диктора скрыты; кнопка паузы рядом остаётся доступной. */
function ClipMedia({
  sizes,
  video,
}: {
  sizes: string;
  video: RefObject<HTMLVideoElement | null> | null;
}) {
  return (
    <div className="timelapse-clip__frame" aria-hidden="true">
      <picture className="timelapse-clip__poster">
        <source type="image/avif" srcSet={TIMELAPSE_POSTER.avif} sizes={sizes} />
        <img
          src={TIMELAPSE_POSTER.src}
          srcSet={TIMELAPSE_POSTER.webp}
          sizes={sizes}
          alt=""
          width={TIMELAPSE_FRAME.width}
          height={TIMELAPSE_FRAME.height}
          loading="lazy"
          decoding="async"
        />
      </picture>
      {video ? (
        <video
          ref={video}
          className="timelapse-clip__video"
          muted
          playsInline
          preload="none"
          disablePictureInPicture
        />
      ) : null}
    </div>
  );
}
