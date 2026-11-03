"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useUnitsEditContext, type UnitsEditContextValue } from "@/lib/admin/units/editContext";
import type { PriceChange } from "@/lib/admin/units/types";
import { parsePriceInput } from "@vh/shared/format";
import type { UnitRecord } from "@vh/shared/units";

/** Сколько держится «Сохранено · Отменить» (PLAN §10, п. 26). */
export const UNDO_MS = 5000;

const priceOf = (unit: UnitRecord): PriceChange =>
  unit.price !== null
    ? { mode: "total", value: unit.price }
    : unit.pricePerM2 !== null
      ? { mode: "per_m2", value: unit.pricePerM2 }
      : { mode: "none", value: null };

/** Ввод → новая цена; null — менять нечего; "invalid" — не разобрать. */
function changeOf(raw: string, before: PriceChange): PriceChange | null | "invalid" {
  const parsed = parsePriceInput(raw);
  if (parsed.issue) return "invalid";
  const change: PriceChange =
    parsed.value === null
      ? { mode: "none", value: null }
      : { mode: before.mode === "none" ? "total" : before.mode, value: parsed.value };
  return change.mode === before.mode && change.value === before.value ? null : change;
}

/** Сохранение цены одной квартиры и 5 секунд «Отменить» с прежней ценой. */
function useInlinePrice(unit: UnitRecord, context: UnitsEditContextValue | null) {
  const [editing, setEditing] = useState(false);
  const [undo, setUndo] = useState<PriceChange | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);
  const save = async (change: PriceChange, previous: PriceChange | null) => {
    if (!context) return;
    const reply = await context.edit.setPrice([unit], change, () => true);
    setFailed(reply !== null);
    setUndo(reply === null ? previous : null);
  };
  const commit = (raw: string) => {
    setEditing(false);
    const before = priceOf(unit);
    const change = changeOf(raw, before);
    if (change === "invalid") return setFailed(true);
    if (change) void save(change, before);
  };
  return { editing, setEditing, undo, failed, commit, revert: () => undo && void save(undo, null) };
}

type InlinePriceProps = { unit: UnitRecord; children: ReactNode };

/**
 * Цена в строке (экран 4): нажал — поле, Enter или уход из поля — сохранено сразу, 5 секунд
 * «Сохранено · Отменить». Режим цены — как у квартиры (целиком или за м²); пусто — «без цены».
 * У опубликованного ЖК правка сразу идёт на сайт и в журнал (п. 6) — это делает действие цены.
 */
export function InlinePrice({ unit, children }: InlinePriceProps) {
  const t = useTranslations("admin.complexes.units.inlinePrice");
  const context = useUnitsEditContext();
  const price = useInlinePrice(unit, context);
  if (!context) return <>{children}</>;
  if (price.editing) return <PriceInput unit={unit} onCommit={price.commit} onCancel={() => price.setEditing(false)} />;
  return (
    <span className="units-row__price-inline">
      <button
        type="button"
        className="units-row__price-button"
        aria-label={t("edit", { number: unit.number })}
        onClick={() => price.setEditing(true)}
      >
        {children}
      </button>
      {price.undo ? (
        <span className="units-row__price-undo" role="status">
          {t("saved")}{" "}
          <button type="button" onClick={price.revert}>
            {t("undo")}
          </button>
        </span>
      ) : null}
      {price.failed ? (
        <span className="units-row__price-failed" role="alert">
          {t("failed")}
        </span>
      ) : null}
    </span>
  );
}

type PriceInputProps = { unit: UnitRecord; onCommit: (raw: string) => void; onCancel: () => void };

function PriceInput({ unit, onCommit, onCancel }: PriceInputProps) {
  const t = useTranslations("admin.complexes.units.inlinePrice");
  const input = useRef<HTMLInputElement>(null);
  const before = priceOf(unit);
  const cancelled = useRef(false);
  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") input.current?.blur();
    if (event.key === "Escape") {
      cancelled.current = true;
      onCancel();
    }
  };
  return (
    <input
      ref={input}
      className="units-row__price-input"
      defaultValue={before.value ?? ""}
      inputMode="numeric"
      autoFocus
      aria-label={t(before.mode === "per_m2" ? "labelPerM2" : "label", { number: unit.number })}
      onBlur={(event) => (cancelled.current ? undefined : onCommit(event.currentTarget.value))}
      onKeyDown={onKey}
    />
  );
}
