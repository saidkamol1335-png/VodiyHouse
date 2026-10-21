"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { Rule12Check } from "@/components/Rule12Check";
import { segmentedItemClass } from "@/components/Segmented";
import {
  LAYOUT_LIMITS,
  newLayoutDraft,
  type BlockLayouts,
  type LayoutDraft,
  type LayoutRowErrors,
} from "@/lib/admin/complexes/layouts";
import type { ComplexMediaResult, SaveRowsResult } from "@/lib/admin/complexes/types";
import { UploadRefused, uploadComplexFile } from "@/lib/admin/complexes/upload";
import type { FormAction } from "@/lib/admin/developers/types";
import { processImage } from "@/lib/media";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";
import { LayoutRow } from "./LayoutRow";

type ComplexLayoutsFormProps = {
  complexId: string;
  /** Опубликованный ЖК: чертёж сразу на сайте — загрузка с отметкой правила 1.2 (И8). */
  published: boolean;
  blocks: readonly BlockLayouts[];
  action: FormAction<SaveRowsResult>;
  /** null — без облака (служебный стенд): чертежи остаются в браузере. */
  attach: FormAction<ComplexMediaResult> | null;
  blocksHref: string;
};

const IDLE: SaveRowsResult = { status: "idle" };

/** Вкладка «Планировки» (И5): переключатель блоков, строки выбранного блока, сохранение блоком. */
export function ComplexLayoutsForm(props: ComplexLayoutsFormProps) {
  const t = useTranslations("admin.complexes.layouts");
  const [blockId, setBlockId] = useState(props.blocks[0]?.blockId ?? null);
  const block = props.blocks.find((item) => item.blockId === blockId) ?? null;
  if (!block) {
    return (
      <AdminPanel title={t("title")} wide>
        <p className="complex-layouts__empty">
          {t("noBlocks")} <Link href={props.blocksHref}>{t("toBlocks")}</Link>
        </p>
      </AdminPanel>
    );
  }
  return (
    <BlockLayoutsForm
      key={block.blockId}
      {...props}
      block={block}
      onSwitch={(next) => setBlockId(next)}
    />
  );
}

type BlockFormProps = ComplexLayoutsFormProps & {
  block: BlockLayouts;
  onSwitch: (blockId: string) => void;
};

/** Строки блока: после сохранения сервер присылает список с id — берём его вместо черновика. */
function useLayoutRows(layouts: readonly LayoutDraft[], markDirty: () => void) {
  const [rows, setRows] = useState<LayoutDraft[]>([...layouts]);
  const [source, setSource] = useState(layouts);
  if (layouts !== source) {
    setSource(layouts);
    setRows([...layouts]);
  }
  const change = (next: LayoutDraft[]) => {
    setRows(next);
    markDirty();
  };
  return {
    rows,
    update: (key: string, patch: Partial<LayoutDraft>) =>
      change(rows.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    add: (copies: LayoutDraft[] = [newLayoutDraft()]) => change([...rows, ...copies]),
    remove: (key: string) => change(rows.filter((row) => row.key !== key)),
  };
}

function BlockLayoutsForm({
  block,
  blocks,
  complexId,
  published,
  action,
  attach,
  onSwitch,
}: BlockFormProps) {
  const t = useTranslations("admin");
  const guard = useUnsavedGuard(t("complexes.layouts.unsaved"));
  const { rows, update, add, remove } = useLayoutRows(block.layouts, guard.onInput);
  const [rule12, setRule12] = useState(false);
  const [state, formAction, pending] = useActionState(
    (_previous: SaveRowsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset, dirty } = guard;
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = (state.status === "error" ? state.rowErrors : {}) as LayoutRowErrors;

  const switchTo = (next: string) => {
    if (next === block.blockId) return;
    if (dirty && !window.confirm(t("complexes.layouts.unsaved"))) return;
    onSwitch(next);
  };
  const uploadDrawing = async (key: string, file: File | undefined): Promise<string | null> => {
    if (!file) return null;
    const result = await processImage(file, "drawing");
    if (!result.ok) return t(`media.issues.${result.issue.code}`, result.issue);
    try {
      const { id, src } = await uploadComplexFile({
        complexId,
        image: result.image,
        attach,
        rule12,
      });
      update(key, { drawingId: id, drawingSrc: src });
      return null;
    } catch (error) {
      return error instanceof UploadRefused
        ? t(`developers.errors.${error.code}`)
        : t("media.uploadFailed");
    }
  };
  const others = blocks.filter((item) => item.blockId !== block.blockId && item.layouts.length > 0);

  return (
    <AdminPanel title={t("complexes.layouts.title")} wide>
      <form className="complex-layouts" action={formAction} onInput={guard.onInput} noValidate>
        <input type="hidden" name="block" value={block.blockId} />
        <input type="hidden" name="layouts" value={JSON.stringify(rows)} />
        {blocks.length > 1 ? (
          <BlockSwitch blocks={blocks} current={block.blockId} onSwitch={switchTo} />
        ) : null}
        <p className="complex-layouts__lead">{t("complexes.layouts.lead")}</p>
        {published ? (
          <Rule12Check id={`rule12-${block.blockId}`} checked={rule12} onChange={setRule12} />
        ) : null}
        {rows.length === 0 ? (
          <EmptyBlock
            others={others}
            onCopy={(from) => add(from.layouts.map((row) => newLayoutDraft(row)))}
          />
        ) : null}
        <ul className="complex-layouts__rows">
          {rows.map((row) => (
            <LayoutRow
              key={row.key}
              row={row}
              currency={block.currency}
              hasUnits={block.hasUnits}
              issues={rowErrors[row.key]}
              uploadLocked={published && !rule12}
              onChange={(patch) => update(row.key, patch)}
              onDrawing={(file) => uploadDrawing(row.key, file)}
              onDuplicate={() => add([newLayoutDraft(row)])}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
        <div className="complex-layouts__actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => add()}
            disabled={rows.length >= LAYOUT_LIMITS.maxRows}
          >
            + {t("complexes.layouts.add")}
          </Button>
          <div className="complex-layouts__save">
            <ComplexSaveFeedback state={state} />
            <Button type="submit" pending={pending}>
              {pending ? t("complexes.pending") : t("complexes.save")}
            </Button>
          </div>
        </div>
      </form>
    </AdminPanel>
  );
}

type BlockSwitchProps = {
  blocks: readonly BlockLayouts[];
  current: string;
  onSwitch: (id: string) => void;
};

/** «Блок A · Блок B», как на сайте; «Все блоки» нет — новая планировка не попадёт в чужой блок. */
function BlockSwitch({ blocks, current, onSwitch }: BlockSwitchProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div
      className="segmented segmented--lg complex-layouts__switch"
      role="group"
      aria-label={t("switch")}
    >
      {blocks.map((item) => (
        <button
          key={item.blockId}
          type="button"
          className={segmentedItemClass(item.blockId === current)}
          aria-pressed={item.blockId === current}
          onClick={() => onSwitch(item.blockId)}
        >
          {t("blockName", { name: item.blockName })}
          <span className="complex-layouts__count">{item.layouts.length}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyBlock({
  others,
  onCopy,
}: {
  others: readonly BlockLayouts[];
  onCopy: (from: BlockLayouts) => void;
}) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="complex-layouts__empty">
      <p>{t("empty")}</p>
      {others.map((other) => (
        <Button key={other.blockId} size="sm" variant="ghost" onClick={() => onCopy(other)}>
          {t("copyFrom", { name: other.blockName, count: other.layouts.length })}
        </Button>
      ))}
    </div>
  );
}
