"use client";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { panelUpdatedAt } from "@/lib/admin/programs/panels";
import type { ProgramPanel as Panel } from "@/lib/admin/programs/types";
import { formatDate, initialsOf } from "@/lib/format";
import { useNow } from "@/lib/ui/useNow";
import { PanelCalcLink } from "./calcLinks";
import type { ProgramsState } from "./useProgramsState";

const STALE_DAYS = 60;
const DAY_MS = 86_400_000;

export type PanelHeadProps = {
  panel: Panel;
  titleId: string;
  canEdit: boolean;
  state: ProgramsState;
  t: ProgramsT;
};

/** Шапка панели застройщика (мокап CabProg): знак, «N ЖК · включено X из Y», плашка, кнопки. */
export function PanelHead({ panel, titleId, canEdit, state, t }: PanelHeadProps) {
  const now = useNow();
  const updated = panelUpdatedAt(panel);
  const stale = Boolean(updated && now && now - Date.parse(updated) > STALE_DAYS * DAY_MS);
  const active = panel.programs.filter((item) => item.isActive).length;
  const meta = [
    t("panel.complexes", { count: panel.complexes }),
    t("panel.active", { active, total: panel.programs.length }),
    updated ? t("panel.updated", { date: formatDate(new Date(updated)) }) : null,
  ].filter(Boolean);
  return (
    <header className="program-panel__head">
      <span className="program-panel__mark" aria-hidden="true">
        {initialsOf(panel.name)}
      </span>
      <div className="program-panel__titles">
        <h2 id={titleId} className="program-panel__title">
          {panel.name}
        </h2>
        <p className="program-panel__meta">{meta.join(" · ")}</p>
      </div>
      {stale ? <Badge tone="amber">{t("panel.stale")}</Badge> : null}
      <PanelCalcLink panel={panel} t={t} />
      {canEdit ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => state.markChecked(panel)}
          aria-label={t("panel.checkedFor", { name: panel.name })}
          className="program-panel__checked"
        >
          {t("panel.checked")}
        </Button>
      ) : null}
    </header>
  );
}
