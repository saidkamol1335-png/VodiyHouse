"use client";

import { useTranslations } from "next-intl";

type Rule12CheckProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

/** Отметка правила 1.2 у загрузки в опубликованный ЖК или застройщику (И8): без неё — отказ. */
export function Rule12Check({ id, checked, onChange }: Rule12CheckProps) {
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
        <b>{t("rule12Title")}</b> {t("rule12")}
      </span>
    </label>
  );
}
