"use client";

import { useState } from "react";
import {
  addDraftDefaults,
  addLimits,
  nextAddDraft,
  readAddDraft,
  type AddDraft,
  type AddIssues,
} from "@/lib/admin/units/addForm";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import { layoutForSlot, type Riser, type UnitRecord } from "@/lib/units";

type Params = {
  units: readonly UnitRecord[];
  floorsTotal: number;
  risers: readonly Riser[];
  edit: UnitsEditControl;
};

/**
 * «+ Квартира»: место, номер и планировка — по стояку этого места, пока её не трогали. Место и
 * номер проверяются до запроса (база проверит ещё раз). После «Добавить» форма остаётся: номер —
 * следующий, позиция — следующая свободная на этаже, «Добавлена кв. N».
 */
export function useUnitAddForm({ units, floorsTotal, risers, edit }: Params) {
  const limits = addLimits(units, floorsTotal);
  const [draft, setDraft] = useState<AddDraft>(() => addDraftDefaults(units, limits));
  const [layout, setLayout] = useState<string | null>(null);
  const [issues, setIssues] = useState<AddIssues>({});
  const [added, setAdded] = useState<string | null>(null);
  const { reply, pending, send, clear, here } = useEditRequest();
  const slot = {
    entrance: Number(draft.entrance),
    floor: Number(draft.floor),
    position: Number(draft.position),
  };
  const layoutId = layout ?? layoutForSlot(slot, risers) ?? "";
  const change = (next: AddDraft) => {
    setDraft(next);
    setIssues({});
    clear();
    setAdded(null);
  };
  const submit = async () => {
    const read = readAddDraft(draft, units, limits);
    if ("issues" in read) return setIssues(read.issues);
    const input = { ...read.input, layoutId: layoutId || null };
    if ((await send((shown) => edit.addUnit(input, shown))) || !here()) return;
    setAdded(read.input.number);
    setDraft((current) => nextAddDraft(draft, current, [...units, read.input]));
  };
  const layoutByRiser = layout === null && layoutId !== "";
  return {
    draft,
    change,
    layoutId,
    layoutByRiser,
    setLayout,
    limits,
    issues,
    reply,
    added,
    pending,
    submit,
  };
}

export type UnitAddFormState = ReturnType<typeof useUnitAddForm>;
