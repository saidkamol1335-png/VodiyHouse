"use client";

import { useTranslations } from "next-intl";
import { BLOCK_PLAN_LIMITS } from "@/lib/units";

type UnitsBlockHeadProps = {
  name: string;
  count: number;
  /** null — кнопки нет (нет права); иначе — открыта ли форма и почему нельзя. */
  add: {
    /** id кнопки: закрытая форма возвращает на неё фокус. */
    id: string;
    open: boolean;
    blocked: "limit" | "noFloors" | null;
    onToggle: () => void;
  } | null;
};

/** «Блок A · список из 88 квартир» и «+ Квартира» (Н4). */
export function UnitsBlockHead({ name, count, add }: UnitsBlockHeadProps) {
  const t = useTranslations("admin.complexes.units");
  return (
    <div className="units-block__head">
      <p className="units-block__listed">
        <b>{t("blockName", { name })}</b> · {t("listed", { count })}
      </p>
      {add && !add.blocked ? (
        <button
          id={add.id}
          type="button"
          className="units-block__add"
          aria-expanded={add.open}
          onClick={add.onToggle}
        >
          {t("add.open")}
        </button>
      ) : null}
      {add?.blocked ? (
        <p className="units-block__note">
          {add.blocked === "limit"
            ? t("add.limit", { max: BLOCK_PLAN_LIMITS.totalUnits })
            : t("add.noFloors")}
        </p>
      ) : null}
    </div>
  );
}
