"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
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
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";
import { BlockCard } from "./BlockCard";

type ComplexBlocksFormProps = {
  complexId: string;
  blocks: readonly BlockDraft[];
  finishings: readonly SelectOption[];
  action: FormAction<SaveRowsResult>;
};

const IDLE: SaveRowsResult = { status: "idle" };

/** Карточки формы: после сохранения сервер присылает список с id — берём его вместо черновика. */
function useBlockRows(blocks: readonly BlockDraft[], markDirty: () => void) {
  const [rows, setRows] = useState<BlockDraft[]>([...blocks]);
  const [removed, setRemoved] = useState<BlockDraft[]>([]);
  const [source, setSource] = useState(blocks);
  if (blocks !== source) {
    setSource(blocks);
    setRows([...blocks]);
    setRemoved([]);
  }
  const change = (next: BlockDraft[]) => {
    setRows(next);
    markDirty();
  };
  return {
    rows,
    removed,
    update: (key: string, patch: Partial<BlockDraft>) =>
      change(rows.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    move: (index: number, to: number) => change(moveItem(rows, index, to)),
    add: () => {
      const row = newBlockDraft();
      change([...rows, row]);
      return row.key;
    },
    remove: (key: string) => {
      setRemoved((current) => [...current, ...rows.filter((row) => row.key === key)]);
      change(rows.filter((row) => row.key !== key));
    },
    restore: (key: string) => {
      change([...rows, ...removed.filter((row) => row.key === key)]);
      setRemoved((current) => current.filter((row) => row.key !== key));
    },
  };
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
  const { rows, removed, update, move, add, remove, restore } = useBlockRows(blocks, guard.onInput);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(
    (_previous: SaveRowsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset } = guard;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = state.status === "error" ? state.rowErrors : {};

  return (
    <AdminPanel title={t("title")} wide>
      <form className="complex-blocks" action={formAction} onInput={guard.onInput} noValidate>
        <input type="hidden" name="id" value={complexId} />
        <input type="hidden" name="blocks" value={JSON.stringify(rows)} />
        <p className="complex-blocks__lead">{t("lead")}</p>
        {rows.length === 0 ? <p className="complex-blocks__empty">{t("empty")}</p> : null}
        {removed.map((row) => (
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
              open={openKey === row.key || Boolean(rowErrors[row.key])}
              issues={rowErrors[row.key] as BlockRowErrors[string] | undefined}
              finishings={finishings}
              onToggle={() => setOpenKey(openKey === row.key ? null : row.key)}
              onChange={(patch) => update(row.key, patch)}
              onMove={(to) => move(index, to)}
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
