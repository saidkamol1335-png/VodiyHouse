"use client";

import { useId, useState } from "react";

type TermHintProps = {
  /** «Что значит «White box»?» — подпись кнопки для диктора. */
  label: string;
  /** Пояснение «что это значит для вас» из справочника (документы, отделка — ТЗ 4.4, 7.8). */
  text: string;
};

/**
 * «?» у термина сайта (мокап .hintbtn): по нажатию под термином — пояснение из справочника.
 * Раскрытие, а не всплывающее окно: на телефоне не перекрывает страницу. Нет текста — нет «?».
 */
export function TermHint({ label, text }: TermHintProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <button type="button" className="term-hint" aria-expanded={open} aria-controls={id} aria-label={label} onClick={() => setOpen(!open)}>
        <span aria-hidden="true">?</span>
      </button>
      <span id={id} className="term-hint__text" hidden={!open}>
        {text}
      </span>
    </>
  );
}
