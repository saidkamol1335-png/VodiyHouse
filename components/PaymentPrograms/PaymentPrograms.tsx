"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ActionToast } from "@/components/ActionToast";
import { FilterPills } from "@/components/FilterPills";
import {
  effectiveRate,
  type ProgramActions,
  type ProgramPanel as PanelData,
  type ProgramsScreenData,
} from "@/lib/admin/programs/types";
import { ProgramPanel } from "./ProgramPanel";
import { ProgramRate } from "./ProgramRate";
import { type EditingControl, useEditing } from "./useEditing";
import { useProgramsState } from "./useProgramsState";

const ALL = "all";

type PaymentProgramsProps = {
  screen: ProgramsScreenData;
  /** null — менеджер: читает программы, без тумблеров, правки и курса (PLAN §5). */
  actions: ProgramActions | null;
  /** Застройщик из адреса (?developer=slug) — фильтр переживает обновление страницы. */
  initialDeveloper?: string | null;
};

/**
 * Фильтр застройщика: пилюля выбрана — адрес ?developer=slug (без перехода и перерисовки).
 * Открытая карточка скрылась бы с правками — сначала «Уйти без сохранения?».
 */
function useDeveloperFilter(
  panels: readonly PanelData[],
  initial: string | null | undefined,
  editing: EditingControl,
) {
  const [filter, setFilter] = useState(
    initial && panels.some((panel) => panel.slug === initial) ? initial : ALL,
  );
  const choose = (key: string) => {
    const open = editing.editing;
    const hidden =
      open && key !== ALL && panels.find((panel) => panel.id === open.developerId)?.slug !== key;
    if (hidden) {
      if (!editing.confirmLeave()) return;
      editing.close(() => true, null);
    }
    setFilter(key);
    const url = new URL(window.location.href);
    if (key === ALL) url.searchParams.delete("developer");
    else url.searchParams.set("developer", key);
    window.history.replaceState(window.history.state, "", url);
  };
  const visible = filter === ALL ? panels : panels.filter((panel) => panel.slug === filter);
  return { filter, choose, visible };
}

/** Экран «Программы оплаты» (мокап CabProg, шаг 2.4): плашка, фильтр, курс, панели застройщиков. */
export function PaymentPrograms({ screen, actions, initialDeveloper }: PaymentProgramsProps) {
  const t = useTranslations("admin.programs");
  const state = useProgramsState(screen, actions, t);
  const editing = useEditing(t("editor.leave"));
  const { filter, choose, visible } = useDeveloperFilter(state.panels, initialDeveloper, editing);
  const rate = effectiveRate(state.rate);
  const pills = [
    { key: ALL, label: t("filterAll") },
    ...state.panels.map((panel) => ({ key: panel.slug, label: panel.name })),
  ];
  return (
    <div className="payment-programs">
      <p className="payment-programs__notice">
        <Info size={16} aria-hidden="true" />
        {t("notice", { source: rate?.source ?? "cbu" })}
      </p>
      <div className="payment-programs__toolbar">
        <FilterPills label={t("filterLabel")} pills={pills} value={filter} onChange={choose} />
        <ProgramRate state={state} actions={actions} t={t} />
      </div>
      {visible.length === 0 ? <p className="payment-programs__empty">{t("empty")}</p> : null}
      {visible.map((panel) => (
        <ProgramPanel
          key={panel.id}
          panel={panel}
          state={state}
          banks={screen.banks}
          rate={rate}
          actions={actions}
          editing={editing}
          t={t}
        />
      ))}
      <ActionToast message={state.toast} closeLabel={t("toast.close")} onClose={state.closeToast} />
    </div>
  );
}
