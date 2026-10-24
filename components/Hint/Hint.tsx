"use client";

import { useLocale, useTranslations } from "next-intl";
import { createContext, useContext, useId, useState } from "react";
import type { CalcHints, CalcHintSlug } from "@/lib/calc/hints";

/** Тексты подсказок справочника hints; у калькулятора — от страницы (сайт, кабинет, стенд). */
export const HintsContext = createContext<CalcHints>({});

type HintProps = { slug: CalcHintSlug };

/**
 * «?» у термина (ТЗ 4.4, мокап .hintbtn): по нажатию под термином — пояснение в 1–2 предложения.
 * Раскрытие, а не всплывающее окно: на телефоне не перекрывает расчёт. Нет текста — нет «?».
 */
export function Hint({ slug }: HintProps) {
  const hint = useContext(HintsContext)[slug];
  const locale = useLocale() === "uz" ? "uz" : "ru";
  const t = useTranslations("calc.hint");
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!hint || !hint.text[locale]) return null;
  return (
    <>
      <button
        type="button"
        className="hint"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("open", { term: hint.term[locale] })}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">?</span>
      </button>
      <span id={id} className="hint__text" hidden={!open}>
        {hint.text[locale]}
      </span>
    </>
  );
}
