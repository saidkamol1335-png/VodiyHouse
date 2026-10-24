"use client";

import { useRef, useState } from "react";
import type { ProgramKind } from "@/lib/admin/programs/types";

// Какая карточка открыта для правки (Р2): одна на экран. Сменить её — «Изменить» у другой,
// «+ Программа», пилюля застройщика — можно только через «Уйти без сохранения?», если в открытой
// есть несохранённое. Поздний ответ «Сохранить» или «Удалить» закрывает только свою карточку.

/** Что открыто в панели: карточка (id) или новая программа выбранного вида. */
export type EditorTarget = { developerId: string; id: string | null; kind: ProgramKind };

/** Куда вернуть фокус, когда карточка закрылась: «Изменить» карточки или «+ Программа» панели. */
export const editButtonOf = (id: string) => `[data-program-id="${id}"] .program-card__edit`;
export const addButtonOf = (developerId: string) =>
  `[data-developer-id="${developerId}"] .program-panel__add-button`;

function focusLater(selector: string | null) {
  if (!selector) return;
  // После отрисовки: кнопки, на которую возвращаем фокус, в DOM ещё нет, пока открыт редактор.
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

export function useEditing(leaveMessage: string) {
  const [editing, setEditing] = useState<EditorTarget | null>(null);
  const current = useRef<EditorTarget | null>(null);
  const dirty = useRef(false);
  const apply = (next: EditorTarget | null) => {
    current.current = next;
    dirty.current = false;
    setEditing(next);
  };
  /** Можно уйти из открытой карточки: в ней нет правок или их бросить согласились. */
  const confirmLeave = () => !current.current || !dirty.current || window.confirm(leaveMessage);
  const open = (target: EditorTarget) => {
    if (confirmLeave()) apply(target);
  };
  /** Закрыть открытую, если это она (matches), и вернуть фокус туда, откуда её открыли. */
  const close = (matches: (target: EditorTarget) => boolean, focus: string | null) => {
    if (!current.current || !matches(current.current)) return;
    apply(null);
    focusLater(focus);
  };
  const setDirty = (value: boolean) => {
    dirty.current = value;
  };
  return { editing, open, close, confirmLeave, setDirty };
}

export type EditingControl = ReturnType<typeof useEditing>;
