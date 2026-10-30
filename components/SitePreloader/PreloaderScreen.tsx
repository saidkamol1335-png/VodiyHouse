"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { MARK_RECTS } from "@/components/Logo/markRects";
import { isPreloading } from "@/lib/site/timelapse/heroLoad";
import { runPreloader } from "./runPreloader";

type PreloaderScreenProps = {
  note: string;
  caption: string;
};

const MARK = { width: 148, height: 110 };
const SLABS = 6;

/** Смещение блока знака к центру: уходя, знак схлопывается в янтарный квадрат. */
function blockStyle([x, y, width, height]: readonly number[], index: number): CSSProperties {
  return {
    "--preloader-i": index,
    "--preloader-dx": `${MARK.width / 2 - (x! + width! / 2)}px`,
    "--preloader-dy": `${MARK.height / 2 - (y! + height! / 2)}px`,
  } as CSSProperties;
}

function PreloaderMark() {
  return (
    <svg
      className="site-preloader__logo"
      viewBox={`0 0 ${MARK.width} ${MARK.height}`}
      focusable="false"
    >
      {MARK_RECTS.map((rect, index) => (
        <rect
          key={`${rect[0]}-${rect[1]}`}
          className="site-preloader__block"
          x={rect[0]}
          y={rect[1]}
          width={rect[2]}
          height={rect[3]}
          style={blockStyle(rect, index)}
        />
      ))}
    </svg>
  );
}

function PreloaderCurtain() {
  return (
    <div className="site-preloader__curtain">
      {Array.from({ length: SLABS }, (_, index) => (
        <span
          key={index}
          className="site-preloader__slab"
          style={{ "--preloader-i": index } as CSSProperties}
        />
      ))}
    </div>
  );
}

/**
 * Заход на сайт, как в артефакте «Vodiy House Закат»: знак собирается из блоков, пока приходит первый
 * экран, затем открывает страницу. Сервер рендерит экран всегда, а виден он только с меткой на <html>
 * (скрипт в <head>), поэтому без скриптов и в уже начатой сессии его нет.
 */
export function PreloaderScreen({ note, caption }: PreloaderScreenProps) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || !isPreloading()) return;
    return runPreloader(element);
  }, []);

  return (
    <div ref={root} className="site-preloader" aria-hidden="true">
      <span className="site-preloader__bg" />
      <PreloaderMark />
      <div className="site-preloader__meta site-preloader__fade">
        <span className="site-preloader__brand">Vodiy House</span>
        <span className="site-preloader__note">{note}</span>
      </div>
      <div className="site-preloader__count site-preloader__fade">
        <span data-preloader-count>000</span>
        <span className="site-preloader__percent">%</span>
      </div>
      <p className="site-preloader__caption site-preloader__fade">{caption}</p>
      <div className="site-preloader__bar site-preloader__fade">
        <span className="site-preloader__fill" />
      </div>
      <span className="site-preloader__core" />
      <PreloaderCurtain />
    </div>
  );
}
