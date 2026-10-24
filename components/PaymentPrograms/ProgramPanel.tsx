"use client";

import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/Button";
import { ProgramCard } from "@/components/ProgramCard";
import { programFullName, type ProgramsT } from "@/components/ProgramCard/cardText";
import { ProgramEditor } from "@/components/ProgramEditor";
import { draftFromItem, newDraft } from "@/lib/admin/programs/draft";
import {
  PROGRAM_KINDS,
  type BankOption,
  type ProgramActions,
  type ProgramItem,
  type ProgramKind,
  type ProgramPanel as Panel,
} from "@/lib/admin/programs/types";
import type { ExchangeRate } from "@/lib/calc/money";
import type { MoveDirection } from "@/lib/ui/useMoveFocus";
import { ProgramCalcLink } from "./calcLinks";
import { PanelHead } from "./PanelHead";
import { addButtonOf, editButtonOf, type EditingControl, type EditorTarget } from "./useEditing";
import type { ProgramsState } from "./useProgramsState";

type ProgramPanelProps = {
  panel: Panel;
  state: ProgramsState;
  banks: readonly BankOption[];
  rate: ExchangeRate | null;
  actions: ProgramActions | null;
  editing: EditingControl;
  t: ProgramsT;
};

type Moved = { id: string; direction: MoveDirection };

/** Панель застройщика (мокап CabProg): знак, название, «N ЖК · включено X из Y · обновлено», сетка. */
export function ProgramPanel(props: ProgramPanelProps) {
  const { panel, state, actions, editing, t } = props;
  const titleId = `program-panel-${panel.id}`;
  const [moved, setMoved] = useState<Moved | null>(null);
  const forgetMove = useCallback(() => setMoved(null), []);
  const target = editing.editing;
  const addingKind = target?.developerId === panel.id && target.id === null ? target.kind : null;
  return (
    <section
      className="program-panel"
      aria-labelledby={titleId}
      data-testid="program-panel"
      data-developer-id={panel.id}
    >
      <PanelHead panel={panel} titleId={titleId} canEdit={Boolean(actions)} state={state} t={t} />
      <ul className="program-panel__grid">
        {panel.programs.map((item, index) => (
          <PanelItem
            key={item.id}
            {...props}
            itemIndex={index}
            focusMove={moved?.id === item.id ? moved.direction : undefined}
            onMoved={(direction) => setMoved({ id: item.id, direction })}
            onMoveFocused={forgetMove}
          />
        ))}
        {addingKind ? <PanelEditor key={`new-${addingKind}`} {...props} itemIndex={-1} /> : null}
        {actions ? (
          <AddProgram
            name={panel.name}
            onPick={(kind) => editing.open({ developerId: panel.id, id: null, kind })}
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

type PanelItemProps = ProgramPanelProps & {
  itemIndex: number;
  focusMove?: MoveDirection;
  onMoved?: (direction: MoveDirection) => void;
  onMoveFocused?: () => void;
};

function PanelItem(props: PanelItemProps) {
  const { panel, state, actions, editing, itemIndex } = props;
  const item = panel.programs[itemIndex]!;
  if (editing.editing?.id === item.id) return <PanelEditor {...props} />;
  const tools = actions
    ? {
        open: false,
        first: itemIndex === 0,
        last: itemIndex === panel.programs.length - 1,
        pending: state.isPending(item),
        refusal: state.refusal?.id === item.id ? state.refusal.text : null,
        focusMove: props.focusMove,
        onMoveFocused: props.onMoveFocused ?? (() => {}),
        onToggle: (next: boolean) => state.toggle(item, next),
        onEdit: () => editing.open({ developerId: panel.id, id: item.id, kind: item.kind }),
        onMove: (direction: MoveDirection) => {
          props.onMoved?.(direction);
          void state.move(panel, item, direction);
        },
      }
    : undefined;
  const name = programFullName(item, props.t);
  const footer = <ProgramCalcLink panel={panel} item={item} name={name} t={props.t} />;
  return <ProgramCard item={item} panel={panel} rate={props.rate} tools={tools} footer={footer} />;
}

/** Куда фокус после удаления: «Изменить» следующей карточки, иначе предыдущей, иначе «+ Программа». */
function afterRemove(panel: Panel, id: string): string {
  const index = panel.programs.findIndex((item) => item.id === id);
  const neighbour = panel.programs[index + 1] ?? panel.programs[index - 1];
  return neighbour ? editButtonOf(neighbour.id) : addButtonOf(panel.id);
}

/** Ответы открытой карточки: каждый закрывает только свою (поздний ответ чужую не тронет). */
function editorHandlers({ panel, state, editing, t }: PanelItemProps, item: ProgramItem | null) {
  const isOwn = (open: EditorTarget) =>
    item ? open.id === item.id : open.developerId === panel.id && open.id === null;
  return {
    onSaved: (saved: ProgramItem) => {
      state.putItem(saved);
      // Новая программа встаёт карточкой (выключенной, Р4): правка открытой — продолжается.
      if (item) return;
      editing.close(isOwn, editButtonOf(saved.id));
      state.notify("success", t("editor.saved"));
    },
    onCopied: (copy: ProgramItem) => state.putItem(copy),
    onRemoved: (id: string) => {
      const focus = afterRemove(panel, id);
      state.dropItem(panel.id, id);
      editing.close((open) => open.id === id, focus);
      state.notify("success", t("toast.deleted"));
    },
    onClose: () => editing.close(isOwn, item ? editButtonOf(item.id) : addButtonOf(panel.id)),
  };
}

function PanelEditor(props: PanelItemProps) {
  const { panel, state, actions, editing, itemIndex } = props;
  const item = itemIndex >= 0 ? panel.programs[itemIndex]! : null;
  const target = editing.editing;
  if (!actions || !target) return null;
  const copyTargets = state.panels
    .filter((other) => other.id !== panel.id)
    .map((other) => ({ id: other.id, name: other.name }));
  return (
    <ProgramEditor
      initial={item ? draftFromItem(item) : newDraft(target.kind, panel.id)}
      item={item}
      panel={panel}
      copyTargets={copyTargets}
      banks={props.banks}
      rate={props.rate}
      actions={actions}
      onDirtyChange={editing.setDirty}
      {...editorHandlers(props, item)}
    />
  );
}

type AddProgramProps = { name: string; onPick: (kind: ProgramKind) => void; t: ProgramsT };

function AddProgram({ name, onPick, t }: AddProgramProps) {
  const [open, setOpen] = useState(false);
  return (
    <li className="program-panel__add">
      <Button
        variant="ghost"
        aria-expanded={open}
        aria-label={t("panel.addFor", { name })}
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
