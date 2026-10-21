"use client";

import { useState } from "react";

type Keyed = { key: string };

type DraftOptions = {
  /** Есть несохранённые правки (useUnsavedGuard). */
  dirty: boolean;
  /** Отметка своего «Сохранено»; null — сохранения не было или последний ответ — ошибка. */
  savedAt: number | null;
  markDirty: () => void;
};

/**
 * Черновик списка вкладки («Блоки», «Планировки»). Правки — функциональными обновлениями: ответ
 * загрузки чертежа ложится на актуальные строки, а не на снимок до неё. Список с сервера берём,
 * когда черновик чистый или пришло своё «Сохранено» (строки с id); refresh от другой части
 * страницы (статус в шапке) несохранённое не стирает.
 */
export function useDraftRows<T extends Keyed>(server: readonly T[], options: DraftOptions) {
  const { dirty, savedAt, markDirty } = options;
  const [rows, setRows] = useState<T[]>([...server]);
  const [source, setSource] = useState(server);
  const [appliedAt, setAppliedAt] = useState(savedAt);
  const ownSave = savedAt !== null && savedAt !== appliedAt;
  const replaced = server !== source && (!dirty || ownSave);
  if (replaced) {
    setSource(server);
    setRows([...server]);
    setAppliedAt(savedAt);
  }
  const change = (next: (current: T[]) => T[]) => {
    setRows(next);
    markDirty();
  };
  return {
    rows,
    /** true в рендер, где черновик заменён списком с сервера: своё состояние родитель сбрасывает. */
    replaced,
    change,
    update: (key: string, patch: Partial<T>) =>
      change((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row))),
    remove: (key: string) => change((current) => current.filter((row) => row.key !== key)),
  };
}
