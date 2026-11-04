"use client";

import { useLayoutEffect, useRef } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import { getMotionTier } from "@/lib/motion";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import { type PortalRect, portalFrames } from "./portalFrames";

export type PortalLayerData = { id: number; index: number; origin: PortalRect };

/** Длительность раскрытия образца — 1,2 с expo.out. */
const DURATION_MS = 1200;

type PortalLayerProps = { layer: PortalLayerData; photo: CatalogPhoto; alt: string; sizes: string; onDone: (id: number) => void };

/**
 * Слой-портал Portal Carousel: окно стартует ровно в прямоугольнике превью и растёт на весь кадр
 * (образец анимирует left/top/width/height — здесь то же через transform: окно — неравномерный scale,
 * картинка — обратный, кадры по expo.out); lite — проявление 0,3 с, none — сразу. Слои копятся
 * (z-index 10 + id), законченный уходит вместе со старшими.
 */
export function PortalLayer({ layer, photo, alt, sizes, onDone }: PortalLayerProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useLayoutEffect(() => {
    done.current = onDone;
  });
  useLayoutEffect(() => {
    const box = outer.current;
    const view = inner.current;
    const frame = box?.parentElement;
    if (!box || !view || !frame) return;
    const finish = () => done.current(layer.id);
    const tier = getMotionTier();
    if (tier === "none") return finish();
    if (tier !== "full") {
      const fade = box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease-out", fill: "both" });
      fade.onfinish = finish;
      return () => fade.cancel();
    }
    const { outer: outerFrames, inner: innerFrames } = portalFrames(layer.origin, { w: frame.offsetWidth, h: frame.offsetHeight }, 28, 0);
    const timing = { duration: DURATION_MS, easing: "linear", fill: "both" } as const;
    const grow = box.animate(outerFrames, timing);
    const counter = view.animate(innerFrames, timing);
    grow.onfinish = finish;
    return () => {
      grow.cancel();
      counter.cancel();
    };
  }, [layer]);
  return (
    <div ref={outer} className="complex-gallery__layer" style={{ zIndex: 10 + layer.id, backgroundImage: photo.blur ? `url("${photo.blur}")` : undefined }}>
      <div ref={inner} className="complex-gallery__layer-view">
        <SitePhoto photo={photo} alt={alt} frame="cover" fit="contain" sizes={sizes} className="complex-gallery__photo" />
      </div>
    </div>
  );
}
