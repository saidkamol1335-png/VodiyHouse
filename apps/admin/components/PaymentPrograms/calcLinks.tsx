"use client";

import { Calculator } from "lucide-react";
import { createContext, useContext } from "react";
import { Button } from "@/components/Button";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { calculable } from "@/lib/admin/programs/panels";
import type { ProgramItem, ProgramPanel } from "@/lib/admin/programs/types";

// Вход в «Расчёт для клиента» из списка программ (Р1 A, PLAN §7 «открывается с выбранной
// программой из кабинета»): «Расчёт для клиента» у панели застройщика и «Рассчитать» у карточки.

/** Адрес вкладки расчёта: в кабинете — /admin/programmy/raschet, на стенде — его копия. */
export const CalcBaseContext = createContext<string | null>(null);

function calcHref(base: string, developer: string, program?: string): string {
  const search = new URLSearchParams({ developer });
  if (program) search.set("program", program);
  return `${base}?${search}`;
}

/** Посчитать можно только включённую программу, которая действует хотя бы на один блок. */
const canCalculate = (item: ProgramItem) => calculable(item.isActive, item.record);

export function PanelCalcLink({ panel, t }: { panel: ProgramPanel; t: ProgramsT }) {
  const base = useContext(CalcBaseContext);
  if (!base || !panel.programs.some(canCalculate)) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      href={calcHref(base, panel.slug)}
      aria-label={t("panel.calcFor", { name: panel.name })}
    >
      <Calculator size={16} aria-hidden="true" />
      {t("panel.calc")}
    </Button>
  );
}

type ProgramCalcLinkProps = { panel: ProgramPanel; item: ProgramItem; name: string; t: ProgramsT };

export function ProgramCalcLink({ panel, item, name, t }: ProgramCalcLinkProps) {
  const base = useContext(CalcBaseContext);
  if (!base || !canCalculate(item)) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      href={calcHref(base, panel.slug, item.id)}
      aria-label={t("card.calcFor", { name })}
      className="program-card__calc"
    >
      <Calculator size={16} aria-hidden="true" />
      {t("card.calc")}
    </Button>
  );
}
