"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import {
  LAYOUT_LIMITS,
  newLayoutDraft,
  type BlockLayouts,
  type LayoutDraft,
} from "@/lib/admin/complexes/layouts";
import { layoutVariants } from "@/lib/admin/units/layoutVariants";
import { EmptyBlock } from "./BlockSwitch";
import { LayoutRow } from "./LayoutRow";
import type { useDrawingUpload } from "./useDrawingUpload";
import type { LayoutsDraft } from "./useLayoutsDraft";

type LayoutRowsProps = {
  block: BlockLayouts;
  blocks: readonly BlockLayouts[];
  draft: LayoutsDraft;
  drawings: ReturnType<typeof useDrawingUpload>;
};

// Сохранённые двойники — «вариант N», как в списках «Квартир» (новые строки id ещё не имеют).
const savedVariants = (rows: LayoutDraft[]) =>
  layoutVariants(
    rows.flatMap((row) => (row.id ? [{ id: row.id, rooms: row.rooms, area: row.area }] : [])),
  );

/** Строки блока; у пустого — «Скопировать из блока …» с планировками других блоков. */
export function LayoutRows({ block, blocks, draft, drawings }: LayoutRowsProps) {
  const others = blocks.filter((item) => item.blockId !== block.blockId && item.layouts.length > 0);
  const variants = savedVariants(draft.rows);
  return (
    <>
      {draft.rows.length === 0 ? (
        <EmptyBlock
          others={others}
          onCopy={(from) => draft.add(from.layouts.map((row) => newLayoutDraft(row)))}
        />
      ) : null}
      <ul className="complex-layouts__rows">
        {draft.rows.map((row) => (
          <LayoutRow
            key={row.key}
            row={row}
            currency={block.currency}
            hasUnits={block.hasUnits}
            variant={(row.id && variants.get(row.id)) || null}
            issues={draft.rowErrors[row.key]}
            uploadLocked={drawings.locked}
            onChange={(patch) => draft.update(row.key, patch)}
            onDrawing={(file) => drawings.upload(row.key, file)}
            onDuplicate={() => draft.add([newLayoutDraft(row)])}
            onRemove={() => draft.remove(row.key)}
          />
        ))}
      </ul>
    </>
  );
}

export function LayoutsActions({ draft, uploading }: { draft: LayoutsDraft; uploading: boolean }) {
  const t = useTranslations("admin.complexes");
  return (
    <div className="complex-layouts__actions">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => draft.add()}
        disabled={draft.rows.length >= LAYOUT_LIMITS.maxRows}
      >
        + {t("layouts.add")}
      </Button>
      <div className="complex-layouts__save">
        <ComplexSaveFeedback state={draft.state} />
        <Button type="submit" pending={draft.pending} disabled={uploading}>
          {draft.pending ? t("pending") : t("save")}
        </Button>
      </div>
    </div>
  );
}
