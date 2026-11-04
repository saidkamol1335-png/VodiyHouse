"use client";

import { Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type CSSProperties, type MouseEvent, type ReactNode, type RefObject, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { GalleryViewer } from "./GalleryViewer";
import { type PortalLayerData, PortalLayer } from "./PortalLayer";
import { RollingText } from "./RollingText";
import { useThumbFollow } from "./useThumbFollow";

type ComplexGalleryProps = {
  photos: readonly CatalogPhoto[];
  /** «ЖК Shodlik» — подпись фото без своего alt. */
  name: string;
  locale: "ru" | "uz";
  /** Сердце и «Поделиться» в углу фото (мокап .gal .jc__icons). */
  tools?: ReactNode;
};

const SIZES = "(max-width: 760px) 100vw, (max-width: 1280px) calc(100vw - 64px), 1216px";
const THUMB_SIZES = "200px";
/** Выпрыгивание превью после клика: scale .2 → 1 за 0,45 с expo.out. */
const POP_MS = 450;
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Рамка — в родных пропорциях обложки (решение исполнителя 03.11.2026: рендеры без обрезки). */
const frameOf = ({ width, height }: CatalogPhoto) => ({ "--gallery-ratio": `${width} / ${height}` }) as CSSProperties;

/**
 * Галерея ЖК (ТЗ 7.3а) — Portal Carousel (@hyperiux, MIT) один в один (04.11.2026): за курсором идёт
 * превью следующего рендера с меткой «Далее», клик в любом месте раскрывает его порталом на весь кадр,
 * слева перекатываются счётчик и подпись; по кругу. Во весь экран — кнопка ⤢ (решение исполнителя).
 * Рендеры — целиком, без обрезки (решение исполнителя 03.11).
 */
export function ComplexGallery({ photos, name, locale, tools }: ComplexGalleryProps) {
  const t = useTranslations("complex.gallery");
  const { root, thumb, button, label, base, target: targetIndex, next: nextIndex, layers, advance, onLayerDone, onRootClick, jump } = usePortalCarousel(photos.length);
  const [viewer, setViewer] = useState<number | null>(null);
  const [cover] = photos;
  if (!cover) return null;
  const altOf = (photo: CatalogPhoto) => photo.alt?.[locale] || name;
  const current = photos[base] ?? cover;
  const next = photos[nextIndex] ?? cover;
  const target = photos[targetIndex] ?? cover;
  return (
    <div ref={root} className="complex-gallery" style={frameOf(cover)} role="group" aria-roledescription="carousel" aria-label={t("label", { name })} onClick={onRootClick}>
      <div className="complex-gallery__base" style={current.blur ? { backgroundImage: `url("${current.blur}")` } : undefined}>
        <SitePhoto key={current.path} photo={current} alt={altOf(current)} frame="cover" fit="contain" sizes={SIZES} preload={base === 0} className="complex-gallery__photo" />
      </div>
      {/* Следующий рендер грузится заранее тем же кандидатом — портал не ждёт сети. */}
      {photos.length > 1 ? <SitePhoto key={`pre-${next.path}`} photo={next} alt="" frame="cover" fit="contain" sizes={SIZES} className="complex-gallery__preload" /> : null}
      <div className="complex-gallery__layers">
        {layers.map((layer) => {
          const photo = photos[layer.index];
          return photo ? <PortalLayer key={layer.id} layer={layer} photo={photo} alt="" sizes={SIZES} onDone={onLayerDone} /> : null;
        })}
      </div>
      <GalleryCaption index={targetIndex} total={photos.length} title={target.alt?.[locale] || name} />
      {photos.length > 1 ? <GalleryThumb thumbRef={thumb} buttonRef={button} labelRef={label} photo={next} label={t("next")} tag={t("nextLabel")} onAdvance={advance} /> : null}
      <div className="complex-gallery__tools">
        {tools}
        <button type="button" className="complex-gallery__expand" aria-label={t("open")} onClick={() => setViewer(base)}>
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

type ThumbProps = {
  thumbRef: RefObject<HTMLDivElement | null>;
  buttonRef: RefObject<HTMLButtonElement | null>;
  labelRef: RefObject<HTMLSpanElement | null>;
  photo: CatalogPhoto;
  label: string;
  tag: string;
  onAdvance: () => void;
};

/** Квадратное превью следующего рендера (min(200px, 42vw)) и метка «Далее». */
function GalleryThumb({ thumbRef, buttonRef, labelRef, photo, label, tag, onAdvance }: ThumbProps) {
  return (
    <>
      <div ref={thumbRef} className="complex-gallery__thumb">
        <button ref={buttonRef} type="button" className="complex-gallery__thumb-button" aria-label={label} onClick={(event) => { event.stopPropagation(); onAdvance(); }}>
          <SitePhoto key={photo.path} photo={photo} alt="" frame="card" sizes={THUMB_SIZES} className="complex-gallery__thumb-photo" />
        </button>
      </div>
      <span ref={labelRef} className="complex-gallery__label" aria-hidden="true">
        {tag}
      </span>
    </>
  );
}

/** Состояние карусели образца: база (current), слои-порталы в пути, цель — последний слой. */
function usePortalCarousel(count: number) {
  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const ids = useRef(0);
  const [base, setBase] = useState(0);
  const [layers, setLayers] = useState<PortalLayerData[]>([]);
  useThumbFollow({ root, thumb, label }, count > 1);
  const wrap = (n: number) => ((n % count) + count) % count;
  const target = layers.length ? (layers[layers.length - 1]?.index ?? base) : base;
  const next = wrap(target + 1);
  const advance = () => {
    const host = root.current;
    const source = button.current;
    if (!host || !source || count < 2) return;
    const frame = host.getBoundingClientRect();
    const rect = source.getBoundingClientRect();
    ids.current += 1;
    const id = ids.current;
    setLayers((previous) => [...previous, { id, index: next, origin: { x: rect.left - frame.left, y: rect.top - frame.top, w: rect.width, h: rect.height } }]);
    if (getMotionTier() === "full") source.animate([{ transform: "scale(0.2)" }, { transform: "scale(1)" }], { duration: POP_MS, easing: EXPO_OUT });
  };
  const onLayerDone = (id: number) => {
    const layer = layers.find((item) => item.id === id);
    if (layer) setBase(layer.index);
    setLayers((previous) => previous.filter((item) => item.id > id));
  };
  const onRootClick = (event: MouseEvent<HTMLDivElement>) => {
    const interactive = (event.target as HTMLElement).closest("a, button, input, select, textarea, [role='button']");
    if (interactive && interactive !== button.current) return;
    advance();
  };
  const jump = (index: number) => {
    setLayers([]);
    setBase(wrap(index));
  };
  return { root, thumb, button, label, base, target, next, layers, advance, onLayerDone, onRootClick, jump };
}
