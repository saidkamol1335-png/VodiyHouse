"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type KeyboardEvent, type UIEvent, useEffect, useRef, useState } from "react";
import { SitePhoto } from "@/components/SitePhoto";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { ComplexDetail } from "./ComplexDetails";

type DetailViewerProps = {
  details: readonly ComplexDetail[];
  start: number;
  locale: Locale;
  complexName: string;
  onClose: () => void;
};

/** Окно открыто сразу на нужном пункте; лента со snap, ← → с клавиатуры, плавно — только full. */
function useViewerTrack(start: number, total: number) {
  const dialog = useRef<HTMLDialogElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(start);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    const node = track.current;
    if (node) node.scrollLeft = start * node.clientWidth;
  }, [start]);
  const goTo = (index: number) => {
    const node = track.current;
    const target = Math.min(Math.max(index, 0), total - 1);
    if (node) node.scrollTo({ left: target * node.clientWidth, behavior: getMotionTier() === "full" ? "smooth" : "auto" });
  };
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    setCurrent(Math.round(scrollLeft / Math.max(clientWidth, 1)));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "ArrowRight") goTo(current + 1);
    if (event.key === "ArrowLeft") goTo(current - 1);
  };
  return { dialog, track, current, goTo, onScroll, onKeyDown };
}

/**
 * Пункт «Деталей проекта» крупно (правки 15.11, п. 22; ТЗ 7.7 «по клику — фото и полный текст»):
 * модальное окно, слева — большое фото, справа — тема и весь текст; пункт без фото — только текст.
 * Стрелки, счётчик «2 / 5», Escape и «×» закрывают.
 */
export function DetailViewer({ details, start, locale, complexName, onClose }: DetailViewerProps) {
  const t = useTranslations("complex.details");
  const { dialog, track, current, goTo, onScroll, onKeyDown } = useViewerTrack(start, details.length);
  const detail = details[current];
  return (
    <dialog
      ref={dialog}
      className="detail-viewer"
      aria-label={detail ? `${detail.name[locale]} · ${t("counter", { n: current + 1, total: details.length })}` : undefined}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <div ref={track} className="detail-viewer__track" onScroll={onScroll}>
        {details.map((item, index) => (
          <article key={item.id} className={item.photo ? "detail-viewer__slide" : "detail-viewer__slide detail-viewer__slide--text"} aria-hidden={index !== current}>
            {item.photo && Math.abs(index - current) <= 1 ? (
              <SitePhoto photo={item.photo} alt={item.photo.alt?.[locale] || `${complexName} · ${item.name[locale]}`} frame="cover" fit="contain" sizes="(max-width: 760px) 100vw, 60vw" className="detail-viewer__photo" />
            ) : null}
            <div className="detail-viewer__text">
              <h3 className="detail-viewer__name">{item.name[locale]}</h3>
              <p className="detail-viewer__body">{item.text[locale]}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="detail-viewer__bar">
        <span className="detail-viewer__count">{t("counter", { n: current + 1, total: details.length })}</span>
        {details.length > 1 ? (
          <span className="detail-viewer__nav">
            <button type="button" className="detail-viewer__arrow" aria-label={t("prev")} disabled={current === 0} onClick={() => goTo(current - 1)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" className="detail-viewer__arrow" aria-label={t("next")} disabled={current >= details.length - 1} onClick={() => goTo(current + 1)}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </span>
        ) : null}
        <button type="button" className="detail-viewer__close" aria-label={t("close")} onClick={() => dialog.current?.close()} autoFocus>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
    </dialog>
  );
}
