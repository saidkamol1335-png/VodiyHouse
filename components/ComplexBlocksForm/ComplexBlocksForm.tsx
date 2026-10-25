"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { FormStatus } from "@/components/FormStatus";
import type { SelectOption } from "@/components/SelectField";
import { BLOCK_LIMITS, type BlockDraft, type BlockRowErrors } from "@/lib/admin/complexes/blocks";
import type { SaveRowsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { BlockCard, type MoveDirection } from "./BlockCard";
import { useBlocksDraft, useOpenCard, type Removed } from "./useBlocksDraft";

type ComplexBlocksFormProps = {
  complexId: string;
  blocks: readonly BlockDraft[];
  finishings: readonly SelectOption[];
  action: FormAction<SaveRowsResult>;
};

type Draft = ReturnType<typeof useBlocksDraft>;

/** Вкладка «Блоки» (И4): карточки-сводки как блоки на сайте, правка на месте, сохранение вкладкой. */
export function ComplexBlocksForm({ complexId, blocks, finishings, action }: ComplexBlocksFormProps) {
  const t = useTranslations("admin.complexes.blocks");
  const draft = useBlocksDraft(blocks, action);
  const [openKey, setOpenKey] = useOpenCard(draft.state);
  return (
    <AdminPanel title={t("title")} wide>
      <form className="complex-blocks" onSubmit={submitKeepingForm(draft.formAction)} onInput={draft.onInput} noValidate>
        <input type="hidden" name="id" value={complexId} />
        <input type="hidden" name="blocks" value={JSON.stringify(draft.rows)} />
        <p className="complex-blocks__lead">{t("lead")}</p>
        {draft.rows.length === 0 ? <p className="complex-blocks__empty">{t("empty")}</p> : null}
        <RemovedNotices removed={draft.removed} onRestore={draft.restore} />
        <BlockCards {...draft} finishings={finishings} openKey={openKey} onOpen={setOpenKey} />
        <BlocksActions {...draft} onAdd={() => setOpenKey(draft.add())} />
      </form>
    </AdminPanel>
  );
}

function RemovedNotices({ removed, onRestore }: { removed: Removed[]; onRestore: (key: string) => void }) {
  const t = useTranslations("admin.complexes.blocks");
  return removed.map(({ row }) => (
    <FormStatus key={row.key} tone="notice" className="complex-blocks__removed">
      {t("removed", { name: row.name || t("unnamed") })}{" "}
      <button type="button" className="complex-blocks__restore" onClick={() => onRestore(row.key)}>
        {t("restore")}
      </button>
    </FormStatus>
  ));
}

type BlockCardsProps = Draft & {
  finishings: readonly SelectOption[];
  openKey: string | null;
  onOpen: (key: string | null) => void;
};

function BlockCards({ rows, rowErrors, finishings, openKey, onOpen, update, move, remove }: BlockCardsProps) {
  const [moved, setMoved] = useState<{ key: string; direction: MoveDirection } | null>(null);
  // Та же функция между рендерами: она — зависимость эффекта фокуса в карточке (useMoveFocus).
  const forgetMove = useCallback(() => setMoved(null), []);
  return (
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
          onToggle={() => onOpen(openKey === row.key ? null : row.key)}
          onChange={(patch) => update(row.key, patch)}
          onMove={(direction) => {
            setMoved({ key: row.key, direction });
            move(index, direction === "up" ? index - 1 : index + 1);
          }}
          onRemove={() => remove(row.key)}
        />
      ))}
    </ul>
  );
}

function BlocksActions({ rows, state, pending, onAdd }: Draft & { onAdd: () => void }) {
  const t = useTranslations("admin.complexes.blocks");
  return (
    <div className="complex-blocks__actions">
      <Button variant="ghost" size="sm" onClick={onAdd} disabled={rows.length >= BLOCK_LIMITS.maxRows}>
        + {t("add")}
      </Button>
      <div className="complex-blocks__save">
        <ComplexSaveFeedback state={state} />
        <Button type="submit" pending={pending}>
          {pending ? t("pending") : t("save")}
        </Button>
      </div>
    </div>
  );
}
