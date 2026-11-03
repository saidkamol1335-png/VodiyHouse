"use client";

import { useTranslations } from "next-intl";
import { monthOfShot } from "@/lib/admin/progress/types";
import { formatMonthYear } from "@vh/shared/format";

type ShotDateFieldProps = {
  value: string;
  min: string;
  max: string;
  /** У возвращённого отчёта прежняя дата может быть раньше окна — её можно оставить. */
  keep?: string | null;
  onChange: (value: string) => void;
};

/** «Дата съёмки» (фаза E, п. 33): сегодня по умолчанию, до 60 дней назад; ниже — месяц отчёта. */
export function ShotDateField({ value, min, max, keep = null, onChange }: ShotDateFieldProps) {
  const t = useTranslations("admin.video.form");
  const floor = keep && keep < min ? keep : min;
  return (
    <div className="progress-form__field">
      <label className="progress-form__label" htmlFor="progress-shot">
        {t("shotDate")}
      </label>
      <input
        id="progress-shot"
        className="progress-form__date"
        type="date"
        name="shotOn"
        value={value}
        min={floor}
        max={max}
        required
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="progress-form__hint">
        {value ? t("shotMonth", { month: formatMonthYear(monthOfShot(value)) }) : t("shotDateHint")}
      </span>
    </div>
  );
}
