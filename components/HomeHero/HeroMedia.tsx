import type { RefObject } from "react";
import type { TimelapseMode } from "@/lib/site/timelapse/useTimelapseMode";
import {
  PHONE_QUERY,
  TIMELAPSE_FRAME,
  TIMELAPSE_PHONE_FRAME,
  TIMELAPSE_POSTER,
} from "@/lib/site/timelapse/assets";

type HeroMediaProps = {
  mode: TimelapseMode;
  /** Кадр целиком: по нему решается, виден ли ролик (на планшете и телефоне под ним ещё полоса фактов). */
  media: RefObject<HTMLDivElement | null>;
  video: RefObject<HTMLVideoElement | null>;
  canvas: RefObject<HTMLCanvasElement | null>;
};

/**
 * Кадр экрана. Постер — последний кадр ролика (вечер): первая картинка страницы во всех режимах (LCP;
 * телефону — вырезка 9:16). Сервер рендерит lite, режим известен только после гидрации — поэтому
 * постер один. full — холст ленты по прокрутке: проявляется с первым кадром (высоко над участком), на
 * последнем уступает постеру — тот же кадр крупнее; lite — ролик один раз и постер; none — только постер.
 */
export function HeroMedia({ mode, media, video, canvas }: HeroMediaProps) {
  return (
    <div ref={media} className="home-hero__media" aria-hidden="true">
      <picture className="home-hero__poster">
        <source
          media={PHONE_QUERY}
          type="image/avif"
          srcSet={TIMELAPSE_POSTER.phoneAvif}
          width={TIMELAPSE_PHONE_FRAME.width}
          height={TIMELAPSE_PHONE_FRAME.height}
        />
        <source
          media={PHONE_QUERY}
          type="image/webp"
          srcSet={TIMELAPSE_POSTER.phoneWebp}
          width={TIMELAPSE_PHONE_FRAME.width}
          height={TIMELAPSE_PHONE_FRAME.height}
        />
        <source type="image/avif" srcSet={TIMELAPSE_POSTER.avif} sizes="100vw" />
        <img
          src={TIMELAPSE_POSTER.src}
          srcSet={TIMELAPSE_POSTER.webp}
          sizes="100vw"
          alt=""
          width={TIMELAPSE_FRAME.width}
          height={TIMELAPSE_FRAME.height}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      {mode === "full" ? <canvas ref={canvas} className="home-hero__canvas" /> : null}
      {mode === "lite" ? (
        <video
          ref={video}
          className="home-hero__video"
          muted
          playsInline
          preload="none"
          disablePictureInPicture
        />
      ) : null}
    </div>
  );
}
