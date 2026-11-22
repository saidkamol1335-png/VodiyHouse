"use client";

import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { GalleryViewer } from "./GalleryViewer";
import { type PortalLayerData, PortalLayer } from "./PortalLayer";
import { RollingText } from "./RollingText";

type ComplexGalleryProps = {
  photos: readonly CatalogPhoto[];
  /** «ЖК Shodlik» — подпись фото без своего alt. */
  name: string;
  locale: "ru" | "uz";
  /** Сердце и «Поделиться» в углу фото (мокап .gal .jc__icons). */
  tools?: ReactNode;
};

const SIZES = "(max-width: 760px) 100vw, (max-width: 1280px) calc(100vw - 64px), 1216px";
/** Свайп на телефоне: от 40 px по горизонтали и больше, чем по вертикали (иначе — прокрутка страницы). */
const SWIPE_PX = 40;

/** Размытое превью кадра под фото: пока грузится, вместо пустого фона. */
const blurOf = (photo: CatalogPhoto): CSSProperties | undefined => (photo.blur ? { backgroundImage: `url("${photo.blur}")` } : undefined);

/** Рамка — в родных пропорциях обложки (решение исполнителя 03.11.2026: рендеры без обрезки). */
const frameOf = ({ width, height }: CatalogPhoto) => ({ "--gallery-ratio": `${width} / ${height}` }) as CSSProperties;

/**
 * Галерея ЖК (ТЗ 7.3а; правки 15.11, п. 15, уточнение 20.11 — «как в Uzum Market»): стрелки ‹ › по
 * краям фото и счётчик «2 / 9» с подписью; по кругу, свайп на телефоне, ← → с клавиатуры. Новый кадр
 * раскрывается порталом от нажатой стрелки (образец Portal Carousel, @hyperiux, MIT: full — рост,
 * lite — проявление, none — сразу). Нажатие (тап) на само фото — во весь экран; кнопка ⤢ осталась.
 * Соседние кадры грузятся заранее; пока грузится — размытое превью, не чёрное. Рендеры — целиком,
 * без обрезки (решение исполнителя 03.11).
 */
export function ComplexGallery({ photos, name, locale, tools }: ComplexGalleryProps) {
  const t = useTranslations("complex.gallery");
  const [viewer, setViewer] = useState<number | null>(null);
  const warm = useAfterLoad();
  const { root, base, target: targetIndex, layers, step, onLayerDone, jump } = usePortalCarousel(photos.length);
  const gestures = useGalleryGestures((delta) => step(delta, null), viewer !== null);
  const [cover] = photos;
  if (!cover) return null;
  const altOf = (photo: CatalogPhoto) => photo.alt?.[locale] || name;
  const at = (index: number) => photos[(index + photos.length) % photos.length] ?? cover;
  const current = photos[base] ?? cover;
  const target = photos[targetIndex] ?? cover;
  // Нажатие на фото — во весь экран на том кадре, к которому идёт карусель; кнопки — своё.
  const onRootClick = (event: MouseEvent<HTMLDivElement>) => {
    // Клик внутри открытого окна всплывает сюда — окно уже открыто.
    if (viewer !== null || gestures.swiped() || (event.target as HTMLElement).closest("a, button, input, select, textarea, dialog, [role='button']")) return;
    setViewer(targetIndex);
  };
  return (
    <div ref={root} className="complex-gallery" style={frameOf(cover)} role="group" aria-roledescription="carousel" aria-label={t("label", { name })} onClick={onRootClick} {...gestures.handlers}>
      <div className="complex-gallery__base" style={blurOf(current)}>
        <SitePhoto key={current.path} photo={current} alt={altOf(current)} frame="cover" fit="contain" sizes={SIZES} preload={base === 0} className="complex-gallery__photo" />
      </div>
      {photos.length > 1 && warm ? <GalleryPreload photos={[at(targetIndex + 1), at(targetIndex - 1)]} /> : null}
      <div className="complex-gallery__layers">
        {layers.map((layer) => {
          const photo = photos[layer.index];
          return photo ? <PortalLayer key={layer.id} layer={layer} photo={photo} alt="" sizes={SIZES} onDone={onLayerDone} /> : null;
        })}
      </div>
      <GalleryCaption index={targetIndex} total={photos.length} title={target.alt?.[locale] || name} />
      {photos.length > 1 ? <GalleryArrows prev={t("prev")} next={t("next")} onStep={step} /> : null}
      <div className="complex-gallery__tools">
        {tools}
        <button type="button" className="complex-gallery__expand" aria-label={t("open")} onClick={() => setViewer(targetIndex)}>
          <Maximize2 size={16} aria-hidden />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {t("photo", { n: base + 1, total: photos.length })}
      </p>
      {viewer !== null ? <GalleryViewer photos={photos} start={viewer} altOf={altOf} onClose={(index) => { setViewer(null); jump(index); }} /> : null}
    </div>
  );
}

/**
 * Соседние кадры — только после загрузки страницы: обложка галереи (LCP) не делит сеть с ними (ревью
 * блока A правок 15.11).
 */
function useAfterLoad(): boolean {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const done = () => setLoaded(true);
    if (document.readyState === "complete") {
      const frame = requestAnimationFrame(done);
      return () => cancelAnimationFrame(frame);
    }
    window.addEventListener("load", done, { once: true });
    return () => window.removeEventListener("load", done);
  }, []);
  return loaded;
}

/**
 * Заранее, теми же кандидатами (правки 15.11, п. 15): следующий и предыдущий кадры — портал и полный
 * экран не ждут сети. Повторы (у 2 фото сосед один) — один раз.
 */
function GalleryPreload({ photos }: { photos: CatalogPhoto[] }) {
  const unique = photos.filter((photo, index) => photos.findIndex((other) => other.path === photo.path) === index);
  return (
    <div className="complex-gallery__preload" aria-hidden="true">
      {unique.map((photo) => (
        <SitePhoto key={`pre-${photo.path}`} photo={photo} alt="" frame="cover" fit="contain" sizes={SIZES} />
      ))}
    </div>
  );
}

/** Счётчик «2 / 9» и подпись слева посередине — перекатываются в момент клика. */
function GalleryCaption({ index, total, title }: { index: number; total: number; title: string }) {
  return (
    <div className="complex-gallery__caption" aria-hidden="true">
      <span className="complex-gallery__counter">
        <RollingText value={String(index + 1)} />
        <span>/ {total}</span>
      </span>
      <RollingText value={title} className="complex-gallery__title" />
    </div>
  );
}

type StepFn = (delta: 1 | -1, source: HTMLElement | null) => void;

/** Стрелки ‹ › по краям фото (ТЗ 7.3а; правки 15.11, п. 15 — «как в Uzum Market»). */
function GalleryArrows({ prev, next, onStep }: { prev: string; next: string; onStep: StepFn }) {
  return (
    <>
      <button type="button" className="complex-gallery__nav complex-gallery__nav--prev" aria-label={prev} onClick={(event) => onStep(-1, event.currentTarget)}>
        <ChevronLeft size={22} strokeWidth={1.8} aria-hidden />
      </button>
      <button type="button" className="complex-gallery__nav complex-gallery__nav--next" aria-label={next} onClick={(event) => onStep(1, event.currentTarget)}>
        <ChevronRight size={22} strokeWidth={1.8} aria-hidden />
      </button>
    </>
  );
}

/**
 * Свайп по фото (телефон, правки 15.11, п. 15): горизонтальный жест листает, следующий за ним клик
 * не открывает полный экран; вертикальный — обычная прокрутка (touch-action: pan-y в CSS). ← → —
 * то же с клавиатуры, когда фокус в галерее; при открытом полном экране — его стрелки.
 */
function useGalleryGestures(onStep: (delta: 1 | -1) => void, paused: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const handlers = {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      start.current = { x: event.clientX, y: event.clientY };
      moved.current = false;
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      const from = start.current;
      start.current = null;
      if (!from || paused) return;
      const dx = event.clientX - from.x;
      if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(event.clientY - from.y)) return;
      moved.current = true;
      onStep(dx < 0 ? 1 : -1);
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (paused || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      onStep(event.key === "ArrowRight" ? 1 : -1);
    },
  };
  return {
    handlers,
    /** Был ли свайп перед этим кликом (сбрасывается при чтении). */
    swiped: () => {
      const was = moved.current;
      moved.current = false;
      return was;
    },
  };
}

/** Состояние карусели образца: база (current), слои-порталы в пути, цель — последний слой. */
function usePortalCarousel(count: number) {
  const root = useRef<HTMLDivElement>(null);
  const ids = useRef(0);
  const [base, setBase] = useState(0);
  const [layers, setLayers] = useState<PortalLayerData[]>([]);
  const wrap = (n: number) => ((n % count) + count) % count;
  const target = layers.length ? (layers[layers.length - 1]?.index ?? base) : base;
  /** Шаг вперёд или назад: портал растёт от нажатой стрелки; свайп и клавиши (source null) — весь кадр. */
  const step = (delta: 1 | -1, source: HTMLElement | null) => {
    const host = root.current;
    if (!host || count < 2) return;
    const frame = host.getBoundingClientRect();
    const rect = source ? source.getBoundingClientRect() : frame;
    ids.current += 1;
    const id = ids.current;
    const index = wrap(target + delta);
    setLayers((previous) => [...previous, { id, index, origin: { x: rect.left - frame.left, y: rect.top - frame.top, w: rect.width, h: rect.height } }]);
  };
  const onLayerDone = (id: number) => {
    const layer = layers.find((item) => item.id === id);
    if (layer) setBase(layer.index);
    setLayers((previous) => previous.filter((item) => item.id > id));
  };
  const jump = (index: number) => {
    setLayers([]);
    setBase(wrap(index));
  };
  return { root, base, target, layers, step, onLayerDone, jump };
}
