"use client";

import { useTranslations } from "next-intl";
import { useActionState, useCallback, useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { FormStatus } from "@/components/FormStatus";
import type { SelectOption } from "@/components/SelectField";
import {
  BLOCK_LIMITS,
  newBlockDraft,
  type BlockDraft,
  type BlockRowErrors,
} from "@/lib/admin/complexes/blocks";
import type { SaveRowsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { moveItem } from "@/lib/ui/sortable";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";
import { BlockCard, type MoveDirection } from "./BlockCard";

type ComplexBlocksFormProps = {
  complexId: string;
  blocks: readonly BlockDraft[];
  finishings: readonly SelectOption[];
  action: FormAction<SaveRowsResult>;
};

const IDLE: SaveRowsResult = { status: "idle" };

/** after — ключи карточек, что шли за удалённой: «Вернуть» ставит её перед первой оставшейся. */
type Removed = { row: BlockDraft; after: string[] };

function restoreRow(current: BlockDraft[], { row, after }: Removed): BlockDraft[] {
  const next = after.find((key) => current.some((item) => item.key === key));
  const at = next ? current.findIndex((item) => item.key === next) : current.length;
  return [...current.slice(0, at), row, ...current.slice(at)];
}

/** Карточки формы: удалённые до сохранения можно «Вернуть» на прежнее место. */
function useBlockRows(blocks: readonly BlockDraft[], options: Parameters<typeof useDraftRows>[1]) {
  const draft = useDraftRows(blocks, options);
  const [removed, setRemoved] = useState<Removed[]>([]);
  if (draft.replaced && removed.length > 0) setRemoved([]);
  const { rows, change } = draft;
  return {
    rows,
    removed,
    update: draft.update,
    move: (index: number, to: number) => change((current) => moveItem(current, index, to)),
    add: () => {
      const row = newBlockDraft();
      change((current) => [...current, row]);
      return row.key;
    },
    remove: (key: string) => {
      const index = rows.findIndex((row) => row.key === key);
      if (index < 0) return;
      const after = rows.slice(index + 1).map((row) => row.key);
      setRemoved((current) => [...current, { row: rows[index]!, after }]);
      draft.remove(key);
    },
    restore: (key: string) => {
      const entry = removed.find((item) => item.row.key === key);
      if (!entry) return;
      change((current) => restoreRow(current, entry));
      setRemoved((current) => current.filter((item) => item.row.key !== key));
    },
  };
}

/** Раскрытая карточка; ответ с ошибками раскрывает первую карточку с ошибкой — один раз. */
function useOpenCard(state: SaveRowsResult) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    const first = state.status === "error" ? Object.keys(state.rowErrors)[0] : undefined;
    if (first) setOpenKey(first);
  }
  return [openKey, setOpenKey] as const;
}

/** Вкладка «Блоки» (И4): карточки-сводки как блоки на сайте, правка на месте, сохранение вкладкой. */
export function ComplexBlocksForm({
  complexId,
  blocks,
  finishings,
  action,
}: ComplexBlocksFormProps) {
  const t = useTranslations("admin.complexes.blocks");
  const guard = useUnsavedGuard(t("unsaved"));
  const [state, formAction, pending] = useActionState(
    (_previous: SaveRowsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { rows, removed, update, move, add, remove, restore } = useBlockRows(blocks, {
    dirty: guard.dirty,
    savedAt,
    markDirty: guard.onInput,
  });
  const [openKey, setOpenKey] = useOpenCard(state);
  const [moved, setMoved] = useState<{ key: string; direction: MoveDirection } | null>(null);
  const forgetMove = useCallback(() => setMoved(null), []);
  const { reset } = guard;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = state.status === "error" ? state.rowErrors : {};

  return (
    <AdminPanel title={t("title")} wide>
      <form
        className="complex-blocks"
        onSubmit={submitKeepingForm(formAction)}
        onInput={guard.onInput}
        noValidate
      >
        <input type="hidden" name="id" value={complexId} />
        <input type="hidden" name="blocks" value={JSON.stringify(rows)} />
        <p className="complex-blocks__lead">{t("lead")}</p>
        {rows.length === 0 ? <p className="complex-blocks__empty">{t("empty")}</p> : null}
        {removed.map(({ row }) => (
          <FormStatus key={row.key} tone="notice" className="complex-blocks__removed">
            {t("removed", { name: row.name || t("unnamed") })}{" "}
            <button
              type="button"
              className="complex-blocks__restore"
              onClick={() => restore(row.key)}
            >
              {t("restore")}
            </button>
          </FormStatus>
        ))}
        <ul className="complex-blocks__cards">
          {rows.map((row, index) => (
            <BlockCard
              key={row.key}
              block={row}
              index={index}
              count={rows.length}
              open={openKey === row.key}
              issues={rowErrors[row.key] as BlockRowErrors[string] | undefined}
              finishings={finishings}
              focusMove={moved?.key === row.key ? moved.direction : undefined}
              onMoveFocused={forgetMove}
              onToggle={() => setOpenKey(openKey === row.key ? null : row.key)}
              onChange={(patch) => update(row.key, patch)}
              onMove={(direction) => {
                setMoved({ key: row.key, direction });
                move(index, direction === "up" ? index - 1 : index + 1);
              }}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
        <div className="complex-blocks__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpenKey(add())}
            disabled={rows.length >= BLOCK_LIMITS.maxRows}
          >
            + {t("add")}
          </Button>
          <div className="complex-blocks__save">
            <ComplexSaveFeedback state={state} />
            <Button type="submit" pending={pending}>
              {pending ? t("pending") : t("save")}
            </Button>
          </div>
        </div>
      </form>
    </AdminPanel>
  );
}
