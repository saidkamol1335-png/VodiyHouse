"use client";

import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useTranslations } from "next-intl";
import {
  MEDIA_FRAMES,
  clampFocus,
  objectPosition,
  type FocusPoint,
  type ImageSize,
} from "@/lib/media";

type FocusPreviewProps = {
  src: string;
  size: ImageSize;
  focus: FocusPoint;
  onFocusChange: (focus: FocusPoint) => void;
};

// Шаг стрелками — 5 % фото: точку можно поставить и без мыши.
const KEY_STEP = 0.05;
const KEY_MOVES: Record<string, FocusPoint> = {
  ArrowLeft: { x: -KEY_STEP, y: 0 },
  ArrowRight: { x: KEY_STEP, y: 0 },
  ArrowUp: { x: 0, y: -KEY_STEP },
  ArrowDown: { x: 0, y: KEY_STEP },
};

/** Точка фокуса (решение фазы 1, в. 4): тап по главному → превью трёх кадров сайта. */
export function FocusPreview({ src, size, focus, onFocusChange }: FocusPreviewProps) {
  const t = useTranslations("admin.media");

  const pickFocus = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onFocusChange(
      clampFocus({
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      }),
    );
  };

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>) => {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    onFocusChange(clampFocus({ x: focus.x + move.x, y: focus.y + move.y }));
  };

  return (
    <div className="focus-preview">
      <button
        type="button"
        className="focus-preview__stage"
        style={{ "--focus-ratio": size.width / size.height } as CSSProperties}
        onClick={pickFocus}
        onKeyDown={moveFocus}
        aria-label={t("focusHint")}
        data-testid="focus-stage"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob: URL, next/image его не оптимизирует */}
        <img className="focus-preview__image" src={src} alt="" draggable={false} />
        <span
          className="focus-preview__marker"
          style={{ left: `${focus.x * 100}%`, top: `${focus.y * 100}%` }}
          aria-hidden="true"
        />
      </button>
      <p className="focus-preview__hint">{t("focusHint")}</p>
      <div className="focus-preview__frames">
        {MEDIA_FRAMES.map((frame) => (
          <figure
            key={frame.key}
            className={`focus-preview__frame focus-preview__frame--${frame.key}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- то же фото, другой кадр */}
            <img
              className="focus-preview__frame-image"
              src={src}
              alt=""
              style={{ objectPosition: objectPosition(size, frame.ratio, focus) }}
              data-testid={`frame-${frame.key}`}
            />
            <figcaption className="focus-preview__caption">{t(`frames.${frame.key}`)}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
