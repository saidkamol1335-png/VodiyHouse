import type { RefObject } from "react";
import { FRAME_HEIGHT, FRAME_WIDTH, HERO_ASSETS } from "./stages";
import type { HeroMode } from "./types";

type HeroMediaProps = {
  mode: HeroMode;
  canvas: RefObject<HTMLCanvasElement | null>;
  video: RefObject<HTMLVideoElement | null>;
};

const PHONE_MEDIA = "(max-width: 767px)";

/**
 * Кадр экрана. Постер «Дом сдан» — первая картинка страницы во всех режимах (LCP; на телефоне —
 * портретный): сервер рендерит lite, а режим известен только после гидрации, поэтому постер один
 * — иначе full скачивал бы два и первый кадр страницы менялся бы дважды. В full поверх него за
 * --dur-hero проявляется холст с первым кадром (и вместе с ним синька), в lite — видео.
 */
export function HeroMedia({ mode, canvas, video }: HeroMediaProps) {
  return (
    <div className="blueprint-hero__media" aria-hidden="true">
      <picture className="blueprint-hero__poster">
        <source media={PHONE_MEDIA} srcSet={HERO_ASSETS.posterEndMobile} />
        <img src={HERO_ASSETS.posterEnd} alt="" width={FRAME_WIDTH} height={FRAME_HEIGHT} fetchPriority="high" decoding="async" />
      </picture>
      {mode === "full" ? <canvas ref={canvas} className="blueprint-hero__canvas" /> : null}
      {mode === "lite" ? <video ref={video} className="blueprint-hero__video" muted playsInline preload="none" disablePictureInPicture /> : null}
      {mode === "full" ? <div className="blueprint-hero__blueprint" /> : null}
      <div className="blueprint-hero__shade" />
    </div>
  );
}
