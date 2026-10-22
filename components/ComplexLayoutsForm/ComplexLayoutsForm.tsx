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
import { layoutVariants } from "@/lib/admin/units/layoutVariants";
import { processImage } from "@/lib/media";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { useDraftRows } from "@/lib/ui/useDraftRows";
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
  /** Вкладка «Квартиры»: «нет в наличии» у блока без списка меняют там (Н7). */
  unitsHref: string;
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

type DrawingUpload = Pick<BlockFormProps, "complexId" | "attach"> & {
  rule12: boolean;
  /** После загрузки: строка получает чертёж, отметка 1.2 снимается (И8: при каждой загрузке). */
  onUploaded: (key: string, drawing: Pick<LayoutDraft, "drawingId" | "drawingSrc">) => void;
};

/**
 * Чертёж строки: подготовка в браузере → бакет → строка media_assets; ответ — текст ошибки.
 * uploading — пока идёт загрузка, вкладку не сохраняют: новая строка получит id с сервера, и
 * ответ загрузки уже не найдёт её по ключу.
 */
function useDrawingUpload({ complexId, attach, rule12, onUploaded }: DrawingUpload) {
  const t = useTranslations("admin");
  const [uploads, setUploads] = useState(0);
  const prepareAndAttach = async (key: string, file: File): Promise<string | null> => {
    const result = await processImage(file, "drawing");
    if (!result.ok) return t(`media.issues.${result.issue.code}`, result.issue);
    try {
      const { id, src } = await uploadComplexFile({
        complexId,
        image: result.image,
        attach,
        rule12,
      });
      onUploaded(key, { drawingId: id, drawingSrc: src });
      return null;
    } catch (error) {
      return error instanceof UploadRefused
        ? t(`developers.errors.${error.code}`)
        : t("media.uploadFailed");
    }
  };
  const upload = async (key: string, file: File | undefined): Promise<string | null> => {
    if (!file) return null;
    setUploads((count) => count + 1);
    try {
      return await prepareAndAttach(key, file);
    } finally {
      setUploads((count) => count - 1);
    }
  };
  return { upload, uploading: uploads > 0 };
}

function BlockLayoutsForm({
  block,
  blocks,
  complexId,
  published,
  action,
  attach,
  unitsHref,
  onSwitch,
}: BlockFormProps) {
  const t = useTranslations("admin");
  const guard = useUnsavedGuard(t("complexes.layouts.unsaved"));
  const [rule12, setRule12] = useState(false);
  const [state, formAction, pending] = useActionState(
    (_previous: SaveRowsResult, formData: FormData) => action(formData),
    IDLE,
  );
  const savedAt = state.status === "saved" ? state.at : null;
  const { reset, dirty } = guard;
  const { rows, update, change, remove } = useDraftRows(block.layouts, {
    dirty,
    savedAt,
    markDirty: guard.onInput,
  });
  const add = (copies: LayoutDraft[] = [newLayoutDraft()]) =>
    change((current) => [...current, ...copies]);
  useEffect(() => {
    if (savedAt) reset();
  }, [savedAt, reset]);
  const rowErrors = (state.status === "error" ? state.rowErrors : {}) as LayoutRowErrors;
  const drawings = useDrawingUpload({
    complexId,
    attach,
    rule12,
    onUploaded: (key, drawing) => {
      update(key, drawing);
      setRule12(false);
    },
  });

  const switchTo = (next: string) => {
    if (next === block.blockId) return;
    if (dirty && !window.confirm(t("complexes.layouts.unsaved"))) return;
    onSwitch(next);
  };
  const others = blocks.filter((item) => item.blockId !== block.blockId && item.layouts.length > 0);

  // Сохранённые двойники — «вариант N», как в списках «Квартир» (новые строки id ещё не имеют).
  const variants = layoutVariants(
    rows.flatMap((row) => (row.id ? [{ id: row.id, rooms: row.rooms, area: row.area }] : [])),
  );
  return (
    <AdminPanel title={t("complexes.layouts.title")} wide>
      {/* Отметка 1.2 — не правка вкладки: вне формы, иначе «Уйти без сохранения?» без правок. */}
      {published ? (
        <Rule12Check
          id={`rule12-${block.blockId}`}
          checked={rule12}
          onChange={setRule12}
          context="drawing"
        />
      ) : (
        <p className="field__meta">{t("media.rule12Hint")}</p>
      )}
      <form
        className="complex-layouts"
        onSubmit={submitKeepingForm(formAction)}
        onInput={guard.onInput}
        noValidate
      >
        <input type="hidden" name="block" value={block.blockId} />
        <input type="hidden" name="layouts" value={JSON.stringify(rows)} />
        {blocks.length > 1 ? (
          <BlockSwitch blocks={blocks} current={block.blockId} onSwitch={switchTo} />
        ) : null}
        <p className="complex-layouts__lead">{t("complexes.layouts.lead")}</p>
        {/* Плашку «нет в наличии» объясняет видимый текст: title на телефоне не открыть. */}
        {!block.hasUnits && rows.some((row) => !row.available) ? (
          <p className="complex-layouts__lead">
            {t("complexes.layouts.unavailableNote")}{" "}
            <Link href={`${unitsHref}?blok=${block.blockId}`}>
              {t("complexes.layouts.toUnits")}
            </Link>
          </p>
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
              variant={(row.id && variants.get(row.id)) || null}
              issues={rowErrors[row.key]}
              uploadLocked={published && !rule12}
              onChange={(patch) => update(row.key, patch)}
              onDrawing={(file) => drawings.upload(row.key, file)}
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
            <Button type="submit" pending={pending} disabled={drawings.uploading}>
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
