"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { LayoutCard } from "@/lib/site/complex/layouts";
import { drawingSrc, useLayoutTitle } from "./LayoutCard";

/**
 * Чертёж крупно (ТЗ 7.4 «клик по чертежу — во весь экран»): модальное окно на белом листе, Escape и
 * «×» закрывают; увеличение — жестом телефона.
 */
export function DrawingZoom({ card, onClose }: { card: LayoutCard; onClose: () => void }) {
  const t = useTranslations("complex.layouts");
  const title = useLayoutTitle()(card);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  if (!card.layout.drawing) return null;
  return (
    <dialog
      ref={dialog}
      className="complex-drawing"
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
    >
      <div className="complex-drawing__sheet">
        <p className="complex-drawing__title">{title}</p>
        <div className="complex-drawing__frame">
          <Image src={drawingSrc(card.layout.drawing.path)} alt={title} fill sizes="(max-width: 760px) 100vw, 900px" className="complex-drawing__image" />
        </div>
        <button type="button" className="complex-drawing__close" aria-label={t("zoomClose")} onClick={() => dialog.current?.close()} autoFocus>
          <X size={20} aria-hidden />
        </button>
      </div>
    </dialog>
  );
}
