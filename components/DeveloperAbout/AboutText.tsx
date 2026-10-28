"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/**
 * Текст «О компании» (мокап MobDev): на телефоне — 6 строк и «Читать полностью», если текст длиннее;
 * на 1440 — целиком. Без JS текст виден целиком (свёрнутым его делает только этот компонент).
 */
export function AboutText({ text }: { text: string }) {
  const t = useTranslations("developers.page");
  const body = useRef<HTMLParagraphElement>(null);
  const [long, setLong] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const node = body.current;
    if (!node) return;
    const measure = () => setLong(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <p ref={body} className={open ? "developer-about__body" : "developer-about__body developer-about__body--clamped"}>
        {text}
      </p>
      {long || open ? (
        <button type="button" className="developer-about__more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("collapse") : t("readMore")}
        </button>
      ) : null}
    </>
  );
}
