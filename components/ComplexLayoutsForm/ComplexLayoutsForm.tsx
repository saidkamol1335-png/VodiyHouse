"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Rule12Check } from "@/components/Rule12Check";
import type { BlockLayouts, LayoutDraft } from "@/lib/admin/complexes/layouts";
import type { ComplexMediaResult, SaveRowsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { submitKeepingForm } from "@/lib/ui/submitKeepingForm";
import { BlockSwitch } from "./BlockSwitch";
import { LayoutRows, LayoutsActions } from "./LayoutRows";
import { useDrawingUpload } from "./useDrawingUpload";
import { useLayoutsDraft } from "./useLayoutsDraft";

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

function BlockLayoutsForm(props: BlockFormProps) {
  const { block, blocks, complexId, published, attach } = props;
  const t = useTranslations("admin.complexes.layouts");
  const draft = useLayoutsDraft(props);
  const drawings = useDrawingUpload({ complexId, attach, published, onUploaded: draft.update });
  return (
    <AdminPanel title={t("title")} wide>
      {/* Отметка 1.2 — не правка вкладки: вне формы, иначе «Уйти без сохранения?» без правок. */}
      <DrawingRule12 published={published} blockId={block.blockId} drawings={drawings} />
      <form
        className="complex-layouts"
        onSubmit={submitKeepingForm(draft.formAction)}
        onInput={draft.onInput}
        noValidate
      >
        <input type="hidden" name="block" value={block.blockId} />
        <input type="hidden" name="layouts" value={JSON.stringify(draft.rows)} />
        <LayoutsIntro
          blocks={blocks}
          block={block}
          rows={draft.rows}
          unitsHref={props.unitsHref}
          onSwitch={draft.switchTo}
        />
        <LayoutRows block={block} blocks={blocks} draft={draft} drawings={drawings} />
        <LayoutsActions draft={draft} uploading={drawings.uploading} />
      </form>
    </AdminPanel>
  );
}

type DrawingRule12Props = {
  published: boolean;
  blockId: string;
  drawings: ReturnType<typeof useDrawingUpload>;
};

function DrawingRule12({ published, blockId, drawings }: DrawingRule12Props) {
  const t = useTranslations("admin.media");
  if (!published) return <p className="field__meta">{t("rule12Hint")}</p>;
  return (
    <Rule12Check
      id={`rule12-${blockId}`}
      checked={drawings.rule12}
      onChange={drawings.setRule12}
      context="drawing"
    />
  );
}

type LayoutsIntroProps = {
  blocks: readonly BlockLayouts[];
  block: BlockLayouts;
  rows: LayoutDraft[];
  unitsHref: string;
  /** С подтверждением «Уйти без сохранения?», если вкладку правили. */
  onSwitch: (blockId: string) => void;
};

function LayoutsIntro({ blocks, block, rows, unitsHref, onSwitch }: LayoutsIntroProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <>
      {blocks.length > 1 ? (
        <BlockSwitch blocks={blocks} current={block.blockId} onSwitch={onSwitch} />
      ) : null}
      <p className="complex-layouts__lead">{t("lead")}</p>
      {/* Плашку «нет в наличии» объясняет видимый текст: title на телефоне не открыть. */}
      {!block.hasUnits && rows.some((row) => !row.available) ? (
        <p className="complex-layouts__lead">
          {t("unavailableNote")}{" "}
          <Link className="complex-layouts__link" href={`${unitsHref}?blok=${block.blockId}`}>
            {t("toUnits")}
          </Link>
        </p>
      ) : null}
    </>
  );
}
