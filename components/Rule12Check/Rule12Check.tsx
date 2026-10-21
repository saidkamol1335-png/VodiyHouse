"use client";

import { useTranslations } from "next-intl";

/** Где появится файл: фото ЖК — сразу, чертёж — после «Сохранить вкладку», застройщика — сразу. */
export type Rule12Context = "photo" | "drawing" | "developer";

type Rule12CheckProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  context: Rule12Context;
};

/**
 * Отметка правила 1.2 у загрузки в опубликованный ЖК или застройщику (И8): без неё — отказ.
 * Ставится на каждую загрузку: после неё родитель снимает галочку.
 */
export function Rule12Check({ id, checked, onChange, context }: Rule12CheckProps) {
  const t = useTranslations("admin.media");
  return (
    <label className="rule12-check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <b>{t("rule12Title")}</b> {t(`rule12.${context}`)}
      </span>
    </label>
  );
}
