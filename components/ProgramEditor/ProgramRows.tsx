"use client";

import { Plus, Trash2 } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import type { ProgramsT } from "@/components/ProgramCard/cardText";
import type { ProgramFieldErrors } from "@/lib/admin/programs/types";
import { errorText } from "./errorText";
import type { RowCommands } from "./useProgramDraft";

// Строки ступеней, сроков и разовых (В2 A): как «Сданные объекты» (Д5) — поля в ряд, корзина,
// ошибка под полем; справа серым — как строку увидят на карточке. На 390 — карточка на строку.

type Row = { key: string };

export type RowColumn<R extends Row> = {
  field: keyof R & string;
  label: string;
  inputMode?: "numeric" | "decimal";
  /** Своя ячейка (выбор вида разового платежа), вместо поля ввода; error — ошибка этой ячейки. */
  render?: (row: R, index: number, error: string | undefined) => ReactNode;
};

type ProgramRowsProps<R extends Row> = {
  /** Имя списка в ошибках: «tiers», «terms», «fees». */
  list: string;
  title: string;
  rows: readonly R[];
  columns: readonly RowColumn<R>[];
  commands: RowCommands<R>;
  errors: ProgramFieldErrors;
  max: number;
  addLabel: string;
  removeLabel: string;
  summary?: (row: R) => string;
  t: ProgramsT;
};

export function ProgramRows<R extends Row>(props: ProgramRowsProps<R>) {
  const { list, rows, errors, t } = props;
  const listError = errorText(errors, list, t);
  return (
    <fieldset className="program-rows" data-testid={`program-rows-${list}`}>
      <legend className="program-rows__title">{props.title}</legend>
      {rows.length > 0 ? (
        <ol className="program-rows__list">
          {rows.map((row, index) => (
            <RowLine key={row.key} {...props} row={row} index={index} />
          ))}
        </ol>
      ) : null}
      {listError ? <p className="program-rows__error">{listError}</p> : null}
      {rows.length < props.max ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={props.commands.add}
          className="program-rows__add"
        >
          <Plus size={16} aria-hidden="true" />
          {props.addLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}

type LineProps<R extends Row> = ProgramRowsProps<R> & { row: R; index: number };

function RowCell<R extends Row>({ column, ...props }: LineProps<R> & { column: RowColumn<R> }) {
  const { list, row, index, commands, errors, t } = props;
  const error = errorText(errors, `${list}.${index}.${column.field}`, t);
  if (column.render) {
    return <div className="program-rows__cell">{column.render(row, index, error)}</div>;
  }
  return (
    <Field
      id={`${row.key}-${column.field}`}
      label={column.label}
      inputMode={column.inputMode ?? "decimal"}
      value={String(row[column.field] ?? "")}
      onChange={(event) =>
        commands.update(row.key, { [column.field]: event.target.value } as Partial<R>)
      }
      error={error}
      className="program-rows__cell"
    />
  );
}

function RowLine<R extends Row>(props: LineProps<R>) {
  const { row, index, columns, commands, removeLabel, summary } = props;
  return (
    <li
      className="program-rows__row"
      style={{ "--program-row-cols": columns.length } as CSSProperties}
    >
      {columns.map((column) => (
        <RowCell key={column.field} {...props} column={column} />
      ))}
      {summary ? <span className="program-rows__summary">{summary(row)}</span> : null}
      <button
        type="button"
        className="program-rows__remove"
        aria-label={`${removeLabel} ${index + 1}`}
        onClick={() => commands.remove(row.key)}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
