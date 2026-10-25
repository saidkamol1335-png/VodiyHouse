"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { BlockDraft } from "@/lib/admin/complexes/blocks";
import { deadlineMoved, type DeadlineChange } from "@/lib/admin/complexes/deadlines";
import type { RemoveDeadlineChangeResult } from "@/lib/admin/complexes/types";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { FormAction } from "@/lib/admin/developers/types";
import { formatDate } from "@/lib/format";
import { quarterOf } from "@/lib/quarters";

// Перенос срока (ТЗ 7.3в): у сохранённого блока новый срок по умолчанию — перенос застройщиком,
// на сайте «перенесён с …»; галочку снимают, если исправляли опечатку. Ошибочную запись убирают
// из истории здесь же — сразу, без «Сохранить вкладку».

type Translate = ReturnType<typeof useTranslations<"admin.complexes.blocks">>;

const quarterText = (t: Translate, quarter: { year: number; quarter: number }) => t("summary.quarter", quarter);

type ShiftProps = { block: BlockDraft; onChange: (patch: Partial<BlockDraft>) => void };

/** «Это перенос срока» — только когда срок сохранённого блока поменяли в черновике. */
export function DeadlineShiftCheck({ block, onChange }: ShiftProps) {
  const t = useTranslations("admin.complexes.blocks");
  const from = block.savedDeadline ? quarterOf(block.savedDeadline) : null;
  if (!deadlineMoved(block) || !from) return null;
  const id = `block-${block.key}-shift`;
  return (
    <label className="deadline-shift" htmlFor={id}>
      <input id={id} type="checkbox" checked={block.deadlineShift} onChange={(event) => onChange({ deadlineShift: event.target.checked })} />
      <span>
        <b>{t("shift.label", { from: quarterText(t, from) })}</b> {t("shift.hint")}
      </span>
    </label>
  );
}

type HistoryProps = {
  changes: readonly DeadlineChange[];
  /** null — без облака (служебный стенд): кнопки «Убрать» нет. */
  remove: FormAction<RemoveDeadlineChangeResult> | null;
};

/** Переносы срока блока, как на сайте: «2 кв. 2027 → 4 кв. 2027 · записан 20.08.2026». */
export function DeadlineHistory({ changes, remove }: HistoryProps) {
  const t = useTranslations("admin.complexes.blocks");
  const tErrors = useTranslations("admin.developers.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ContentErrorCode | null>(null);
  if (changes.length === 0) return null;
  const removeChange = (id: string) => {
    if (!remove || !window.confirm(t("history.confirm"))) return;
    startTransition(async () => {
      const data = new FormData();
      data.set("id", id);
      const result = await remove(data);
      setError(result.status === "error" ? result.error : null);
      if (result.status === "done") router.refresh();
    });
  };
  return (
    <div className="deadline-history">
      <p className="deadline-history__title">{t("history.title")}</p>
      <ul className="deadline-history__list">
        {changes.map((change) => (
          <li key={change.id} className="deadline-history__item">
            <span>
              {t("history.item", { from: quarterText(t, change.from), to: quarterText(t, change.to), date: formatDate(new Date(change.changedOn)) })}
            </span>
            {remove ? (
              <Button size="sm" variant="ghost" pending={pending} onClick={() => removeChange(change.id)}>
                {t("history.remove")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? <FormStatus tone="error">{tErrors(error)}</FormStatus> : null}
    </div>
  );
}
