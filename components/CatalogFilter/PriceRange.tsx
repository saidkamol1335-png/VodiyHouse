"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type PriceRangeProps = {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
};

/** Цена квартиры от … до …, $ (мокап .frng): две половины одной пилюли; пусто — без границы. */
export function PriceRange({ min, max, onChange }: PriceRangeProps) {
  const t = useTranslations("catalog.filter");
  return (
    <div className="catalog-filter__range">
      <PriceInput label={`${t("price")} · ${t("priceFrom")}`} placeholder={t("priceFrom")} value={min} onChange={(value) => onChange(value, max)} />
      <PriceInput label={`${t("price")} · ${t("priceTo")}`} placeholder={t("priceTo")} value={max} onChange={(value) => onChange(min, value)} />
    </div>
  );
}

type PriceInputProps = { label: string; placeholder: string; value: number | null; onChange: (value: number | null) => void };

/** Только цифры; значение уходит в фильтр сразу — выдача пересчитывается в браузере. */
function PriceInput({ label, placeholder, value, onChange }: PriceInputProps) {
  const [text, setText] = useState(value === null ? "" : String(value));
  // Сброс фильтра снаружи (кнопка «Сбросить») очищает и поле.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(value === null ? "" : String(value));
  }
  return (
    <input
      className="catalog-filter__price"
      inputMode="numeric"
      aria-label={label}
      placeholder={placeholder}
      value={text}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 9);
        setText(digits);
        // 0 — как пусто: «от 0» отсекало бы «цену по запросу», а в адрес такая граница не пишется.
        onChange(Number(digits) > 0 ? Number(digits) : null);
      }}
    />
  );
}
