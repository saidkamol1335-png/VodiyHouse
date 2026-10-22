"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import type { UnitsLayout } from "@/lib/admin/units/types";
import { useFocusAfterRender } from "@/lib/ui/useFocusAfterRender";
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
  const focus = useFocusAfterRender();
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
          focus={focus}
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
  /** Фокус после перерисовки: нажатая кнопка уходит вместе со строкой или пропадает сама. */
  focus: (id: string) => void;
};

const rowId = (idPrefix: string, index: number) => `${idPrefix}-r${index}`;

function RiserPosition(props: PositionProps) {
  const { idPrefix, position, rows } = props;
  const t = useTranslations("admin.complexes.units.risers");
  const titleId = `${idPrefix}-title`;
  const commonCount = rows.filter((row) => row.riser.entrance === null).length;
  return (
    <li className="risers-editor__position">
      <p id={titleId} className="risers-editor__title" tabIndex={-1}>
        {t("position", { n: position })}
      </p>
      <ul className="risers-editor__rows" aria-labelledby={titleId}>
        {rows.map(({ riser, index }) => (
          <RiserRow
            key={index}
            id={rowId(idPrefix, index)}
            titleId={titleId}
            riser={riser}
            plan={props.plan}
            layouts={props.layouts}
            issue={props.issues.get(index + 1)}
            removable={riser.entrance !== null || commonCount > 1}
            onChange={(patch) => props.onUpdate(index, patch)}
            onRemove={() => {
              props.onRemove(index);
              props.focus(titleId);
            }}
          />
        ))}
      </ul>
      <PositionActions {...props} titleId={titleId} />
    </li>
  );
}

/** Верхний общий стояк позиции — его делит «Разделить по этажам». */
function topCommon(rows: readonly Row[]): Row | undefined {
  return rows
    .filter((row) => row.riser.entrance === null)
    .reduce<Row | undefined>(
      (best, row) => (!best || row.riser.floorTo > best.riser.floorTo ? row : best),
      undefined,
    );
}

/** «+ Уточнить для подъезда» и «+ Разделить по этажам»: фокус — на первое поле новой строки. */
function PositionActions(props: PositionProps & { titleId: string }) {
  const { idPrefix, position, rows, plan, onInsert, focus, titleId } = props;
  const t = useTranslations("admin.complexes.units.risers");
  const top = topCommon(rows);
  const refinement = refinementOf(position, plan, rows, top?.riser);
  const after = (rows.at(-1)?.index ?? -1) + 1;
  const refine = (riser: Riser) => {
    onInsert(after, riser);
    focus(`${rowId(idPrefix, after)}-entrance`);
  };
  const split = ({ riser, index }: Row) => {
    const change = { floorTo: riser.floorTo - 1 };
    onInsert(index + 1, { ...riser, floorFrom: riser.floorTo }, { index, change });
    focus(`${rowId(idPrefix, index + 1)}-from`);
  };
  // Имя кнопки — её текст, позиция — описанием: такие же кнопки есть у каждой позиции.
  return (
    <div className="risers-editor__actions">
      {refinement ? (
        <Button
          variant="ghost"
          size="sm"
          aria-describedby={titleId}
          onClick={() => refine(refinement)}
        >
          {t("refine")}
        </Button>
      ) : null}
      {top && top.riser.floorTo > top.riser.floorFrom ? (
        <Button variant="ghost" size="sm" aria-describedby={titleId} onClick={() => split(top)}>
          {t("split")}
        </Button>
      ) : null}
    </div>
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
