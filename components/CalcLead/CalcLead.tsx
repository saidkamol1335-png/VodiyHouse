"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { useLeadOpener } from "@/components/LeadDialog";
import type { LeadCalc, LeadObject } from "@/lib/leads/types";

export type CalcLeadRow = { label: string; value: string };

type CalcLeadProps = {
  /** «Ipoteka Bank · Рассрочка через банк · 39 617 000 сум/мес» — плашка над полями окна. */
  context: string;
  /** Что увидит менеджер: программа, стоимость, взнос, срок, платёж. */
  rows: readonly CalcLeadRow[];
  /** О чём расчёт: застройщик (/kalkulyator) или ЖК, планировка и квартира (расчёт квартиры). */
  object: LeadObject;
  /** Снимок расчёта (Р4): база сохранит его с заявкой — условия и курс возьмёт сама. */
  calc: LeadCalc | null;
};

/**
 * «Получить точный расчёт» (решение фазы 2, мокап MobLead, ТЗ 10.1): общее окно заявки сайта с
 * контекстом расчёта; заявка «Расчёт» уходит со строками расчёта и его снимком.
 */
export function CalcLead({ context, rows, object, calc }: CalcLeadProps) {
  const t = useTranslations("lead.buttons");
  const open = useLeadOpener();
  if (!open) return null;
  return (
    <Button
      block
      onClick={() => open({ type: "calc", object, context, calcRows: [...rows], ...(calc ? { calc } : {}) })}
    >
      {t("calc")}
    </Button>
  );
}
