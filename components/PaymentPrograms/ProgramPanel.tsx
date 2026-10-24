"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ProgramCard } from "@/components/ProgramCard";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import { ProgramEditor } from "@/components/ProgramEditor";
import { draftFromItem, newDraft } from "@/lib/admin/programs/draft";
import { panelUpdatedAt } from "@/lib/admin/programs/panels";
import {
  PROGRAM_KINDS,
  type BankOption,
  type ProgramActions,
  type ProgramKind,
  type ProgramPanel as Panel,
} from "@/lib/admin/programs/types";
import type { ExchangeRate } from "@/lib/calc/money";
import { formatDate, initialsOf } from "@/lib/format";
import { useNow } from "@/lib/ui/useNow";
import type { ProgramsState } from "./useProgramsState";

/** Что открыто в панели: карточка (id) или новая программа выбранного вида. */
export type EditorTarget = { developerId: string; id: string | null; kind: ProgramKind };

const STALE_DAYS = 60;
const DAY_MS = 86_400_000;

type ProgramPanelProps = {
  panel: Panel;
  state: ProgramsState;
  banks: readonly BankOption[];
  rate: ExchangeRate | null;
  actions: ProgramActions | null;
  editing: EditorTarget | null;
  onEdit: (target: EditorTarget | null) => void;
  t: ProgramsT;
};

/** Панель застройщика (мокап CabProg): знак, название, «N ЖК · включено X из Y · обновлено», сетка. */
export function ProgramPanel(props: ProgramPanelProps) {
  const { panel, state, actions, t } = props;
  const titleId = `program-panel-${panel.id}`;
  return (
    <section className="program-panel" aria-labelledby={titleId} data-testid="program-panel">
      <PanelHead
        panel={panel}
        titleId={titleId}
        canEdit={Boolean(actions)}
        onChecked={() => state.markChecked(panel)}
        t={t}
      />
      <ul className="program-panel__grid">
        {panel.programs.map((item, index) => (
          <PanelItem key={item.id} {...props} itemIndex={index} />
        ))}
        {props.editing && props.editing.developerId === panel.id && props.editing.id === null ? (
          <PanelEditor {...props} itemIndex={-1} />
        ) : null}
        {actions ? (
          <AddProgram
            onPick={(kind) => props.onEdit({ developerId: panel.id, id: null, kind })}
            t={t}
          />
        ) : null}
      </ul>
      {panel.programs.length === 0 && !actions ? (
        <p className="program-panel__empty">{t("panel.noPrograms")}</p>
      ) : null}
    </section>
  );
}

type PanelHeadProps = {
  panel: Panel;
  titleId: string;
  canEdit: boolean;
  onChecked: () => void;
  t: ProgramsT;
};

function PanelHead({ panel, titleId, canEdit, onChecked, t }: PanelHeadProps) {
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
      {canEdit ? (
        <Button size="sm" variant="ghost" onClick={onChecked} className="program-panel__checked">
          {t("panel.checked")}
        </Button>
      ) : null}
    </header>
  );
}

type PanelItemProps = ProgramPanelProps & { itemIndex: number };

function PanelItem(props: PanelItemProps) {
  const { panel, state, actions, editing, itemIndex } = props;
  const item = panel.programs[itemIndex]!;
  if (editing?.id === item.id) return <PanelEditor {...props} />;
  const tools = actions
    ? {
        open: false,
        first: itemIndex === 0,
        last: itemIndex === panel.programs.length - 1,
        pending: state.pendingId === item.id,
        refusal: state.refusal?.id === item.id ? state.refusal.text : null,
        onToggle: (next: boolean) => state.toggle(item, next),
        onEdit: () => props.onEdit({ developerId: panel.id, id: item.id, kind: item.kind }),
        onMove: (direction: "up" | "down") => state.move(panel, item, direction),
      }
    : undefined;
  return <ProgramCard item={item} panel={panel} rate={props.rate} tools={tools} />;
}

function PanelEditor({
  panel,
  state,
  banks,
  rate,
  actions,
  editing,
  onEdit,
  itemIndex,
  t,
}: PanelItemProps) {
  const item = itemIndex >= 0 ? panel.programs[itemIndex]! : null;
  if (!actions || !editing) return null;
  const initial = item ? draftFromItem(item) : newDraft(editing.kind, panel.id);
  const copyTargets = state.panels
    .filter((other) => other.id !== panel.id)
    .map((other) => ({ id: other.id, name: other.name }));
  return (
    <ProgramEditor
      initial={initial}
      item={item}
      panel={panel}
      copyTargets={copyTargets}
      banks={banks}
      rate={rate}
      actions={actions}
      onSaved={(saved) => {
        state.putItem(saved);
        // Новая программа встаёт карточкой (выключенной, Р4): правка открытой — продолжается.
        if (item) return;
        onEdit(null);
        state.notify("success", t("editor.saved"));
      }}
      onCopied={(copy) => state.putItem(copy)}
      onRemoved={(id) => {
        state.dropItem(panel.id, id);
        onEdit(null);
      }}
      onClose={() => onEdit(null)}
    />
  );
}

function AddProgram({ onPick, t }: { onPick: (kind: ProgramKind) => void; t: ProgramsT }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="program-panel__add">
      <Button
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="program-panel__add-button"
      >
        <Plus size={18} aria-hidden="true" />
        {t("panel.add")}
      </Button>
      {open ? (
        <div className="program-panel__kinds" role="group" aria-label={t("panel.addLabel")}>
          {PROGRAM_KINDS.map((kind) => (
            <Button
              key={kind}
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onPick(kind);
              }}
            >
              {t(`kinds.${kind}`)}
            </Button>
          ))}
        </div>
      ) : null}
    </li>
  );
}
