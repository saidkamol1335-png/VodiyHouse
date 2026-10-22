"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useUnitsEditContext } from "@/lib/admin/units/editContext";
import {
  checkUnitDraft,
  draftChanged,
  draftFromUnit,
  type UnitDraft,
} from "@/lib/admin/units/unitForm";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import { useUnsavedGuard } from "@/lib/ui/useUnsavedGuard";
import type { UnitRecord } from "@/lib/units";

// Форма правки квартиры (Н4): снимок строки на момент открытия — с ним сравнивается черновик, в
// базу уходят только правленые поля. Несохранённая правка держит «Уйти без сохранения?» и для
// ссылок (useUnsavedGuard), и для смены фильтра или другой строки (EditDirty). Пока правка
// сохраняется, уйти можно без вопроса: её ответ придёт и без формы (отказ — строкой в полосе).

export function useUnitEditForm(unit: UnitRecord, onDone: () => void) {
  const t = useTranslations("admin.complexes.units.edit");
  const context = useUnitsEditContext()!;
  const [initial] = useState(unit);
  const [start] = useState(() => draftFromUnit(unit));
  const [draft, setDraft] = useState<UnitDraft>(start);
  const [tried, setTried] = useState(false);
  const { reply, pending, send, clear, here } = useEditRequest();
  const guard = useUnsavedGuard(t("unsaved"));
  const check = checkUnitDraft(initial, draft, context.units);
  const current = context.units.find((item) => item.id === unit.id) ?? null;
  // Правка есть, даже если она пока неверна (номер-дубль) или вернула то, что было при открытии
  // (строку тем временем поменяли): уйти — только спросив.
  const dirty = draftChanged(draft, start) || check.patch !== null;
  useEffect(() => context.dirty.mark(unit.id, dirty && !pending));
  useDraftLost(initial, context);
  const change = (next: UnitDraft) => {
    setDraft(next);
    clear();
    guard.onInput();
  };
  const finish = () => {
    context.dirty.mark(unit.id, false);
    guard.reset();
    // Форму закрыли, пока шло сохранение, — раскрыто уже другое, его не трогаем.
    if (here()) onDone();
  };
  const save = async () => {
    setTried(true);
    if (Object.keys(check.issues).length > 0 || !current) return;
    const patch = check.patch;
    if (!patch) return finish();
    if (!(await send((shown) => context.edit.saveRow(current, patch, shown)))) finish();
  };
  return { context, initial, current, draft, change, check, tried, reply, pending, save };
}

export type UnitEditFormState = ReturnType<typeof useUnitEditForm>;

type EditContext = NonNullable<ReturnType<typeof useUnitsEditContext>>;

/**
 * Форма ушла с несохранённой правкой без «Уйти без сохранения?» — значит, квартиру удалили
 * (другой сотрудник, перечитанный список): правка пропала бы молча, поэтому — строкой в полосе.
 */
function useDraftLost(unit: UnitRecord, { dirty, edit }: EditContext) {
  useEffect(
    () => () => {
      if (dirty.isDirty(unit.id)) edit.draftLost(unit);
      dirty.mark(unit.id, false);
    },
    [dirty, edit, unit],
  );
}
