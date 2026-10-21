"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import type { UnitsLayout } from "@/lib/admin/units/types";
import { validateRisers, type BlockPlan, type Riser, type RiserIssue } from "@/lib/units";
import { RiserRow } from "./RiserFields";

// Стояки строками по позициям (Н5): «Позиция 1 · все подъезды · эт. 2–16 → 1-комн. · 42,5 м²».
// Стояк подъезда уточняет общий; «разделить по этажам» — верхние этажи с другой планировкой.
// Общий для генератора (новый блок) и для готового блока (стояки собраны из квартир).
// Порядок строк при правке не меняется: строки с ключом-индексом не должны прыгать под курсором.

type RisersEditorProps = {
  idPrefix: string;
  plan: BlockPlan;
  risers: readonly Riser[];
  layouts: readonly UnitsLayout[];
  onChange: (risers: Riser[]) => void;
};

/** Проблемы по номеру строки (1…): у пересечения — у обеих строк. */
function issuesByRow(issues: readonly RiserIssue[]): Map<number, RiserIssue> {
  const rows = new Map<number, RiserIssue>();
  for (const issue of issues) {
    rows.set(issue.riser, issue);
    if (issue.code === "riserOverlap" && !rows.has(issue.other)) rows.set(issue.other, issue);
  }
  return rows;
}

export function RisersEditor({ idPrefix, plan, risers, layouts, onChange }: RisersEditorProps) {
  const issues = issuesByRow(validateRisers(plan, risers));
  const positions = [...new Set(risers.map((riser) => riser.position))].sort((a, b) => a - b);
  const rowsOf = (position: number) =>
    risers.flatMap((riser, index) => (riser.position === position ? [{ riser, index }] : []));
  return (
    <ul className="risers-editor">
      {positions.map((position) => (
        <RiserPosition
          key={position}
          idPrefix={`${idPrefix}-p${position}`}
          position={position}
          rows={rowsOf(position)}
          plan={plan}
          layouts={layouts}
          issues={issues}
          onUpdate={(index, patch) =>
            onChange(risers.map((riser, at) => (at === index ? { ...riser, ...patch } : riser)))
          }
          onRemove={(index) => onChange(risers.filter((_, at) => at !== index))}
          onInsert={(at, riser, patch) => onChange(insertRiser(risers, at, riser, patch))}
        />
      ))}
    </ul>
  );
}

type RowPatch = { index: number; change: Partial<Riser> };

/** Новая строка — рядом со своей позицией, остальные остаются на местах. */
function insertRiser(risers: readonly Riser[], at: number, riser: Riser, patch?: RowPatch) {
  const patched = risers.map((item, index) =>
    index === patch?.index ? { ...item, ...patch.change } : item,
  );
  return [...patched.slice(0, at), riser, ...patched.slice(at)];
}

type Row = { riser: Riser; index: number };

type PositionProps = {
  idPrefix: string;
  position: number;
  rows: readonly Row[];
  plan: BlockPlan;
  layouts: readonly UnitsLayout[];
  issues: ReadonlyMap<number, RiserIssue>;
  onUpdate: (index: number, patch: Partial<Riser>) => void;
  onRemove: (index: number) => void;
  /** Новая строка на место at; patch — правка строки выше (у «разделить» укорачивается прежняя). */
  onInsert: (at: number, riser: Riser, patch?: RowPatch) => void;
};

function RiserPosition(props: PositionProps) {
  const { idPrefix, position, rows, plan, issues, onInsert } = props;
  const t = useTranslations("admin.complexes.units.risers");
  const common = rows.filter((row) => row.riser.entrance === null);
  const top = common.reduce<Row | undefined>(
    (best, row) => (!best || row.riser.floorTo > best.riser.floorTo ? row : best),
    undefined,
  );
  const refinement = refinementOf(position, plan, rows, top?.riser);
  const after = (rows.at(-1)?.index ?? -1) + 1;
  return (
    <li className="risers-editor__position">
      <p id={`${idPrefix}-title`} className="risers-editor__title">
        {t("position", { n: position })}
      </p>
      <ul className="risers-editor__rows" aria-labelledby={`${idPrefix}-title`}>
        {rows.map(({ riser, index }) => (
          <RiserRow
            key={index}
            id={`${idPrefix}-r${index}`}
            riser={riser}
            plan={plan}
            layouts={props.layouts}
            issue={issues.get(index + 1)}
            removable={riser.entrance !== null || common.length > 1}
            onChange={(patch) => props.onUpdate(index, patch)}
            onRemove={() => props.onRemove(index)}
          />
        ))}
      </ul>
      <div className="risers-editor__actions">
        {refinement ? (
          <Button variant="ghost" size="sm" onClick={() => onInsert(after, refinement)}>
            {t("refine")}
          </Button>
        ) : null}
        {top && top.riser.floorTo > top.riser.floorFrom ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onInsert(
                top.index + 1,
                { ...top.riser, floorFrom: top.riser.floorTo },
                {
                  index: top.index,
                  change: { floorTo: top.riser.floorTo - 1 },
                },
              )
            }
          >
            {t("split")}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Уточнение для подъезда: первый подъезд, где позиция есть и своего стояка ещё нет; весь жилой
 * диапазон и планировка общего стояка. null — уточнять негде (кнопки нет).
 */
function refinementOf(
  position: number,
  plan: BlockPlan,
  rows: readonly Row[],
  common: Riser | undefined,
): Riser | null {
  const taken = new Set(rows.map((row) => row.riser.entrance));
  const entrance = plan.unitsPerFloor.findIndex(
    (perFloor, index) => perFloor >= position && !taken.has(index + 1),
  );
  if (plan.entrances < 2 || entrance < 0) return null;
  return {
    entrance: entrance + 1,
    position,
    floorFrom: plan.firstResidentialFloor,
    floorTo: plan.floors,
    layoutId: common?.layoutId ?? null,
  };
}
