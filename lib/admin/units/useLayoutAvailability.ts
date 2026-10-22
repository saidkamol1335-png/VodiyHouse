"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { settle } from "@/lib/ui/settle";
import type { ContentErrorCode } from "../developers/errors";
import { unitsFailure } from "./errors";
import type { ChangedResult, SetLayoutAvailableInput, UnitsAction, UnitsLayout } from "./types";

// «Доступна / нет в наличии» у планировки блока без списка (Н7): тап сохраняет сразу, без
// «Отменить» — вернуть можно тем же тапом. Пока ответа нет, планировка показывает новое значение.

type AvailabilityState = {
  /** Сохраняется сейчас: id планировки → новое значение. */
  pending: Readonly<Record<string, boolean>>;
  /** Подтвердила база, а страница ещё не перерисовалась (на стенде — не перерисуется). */
  saved: Readonly<Record<string, boolean>>;
  errors: Readonly<Record<string, ContentErrorCode>>;
  /** Для диктора: что сохранилось последним. */
  last: { layoutId: string; available: boolean } | null;
};

/**
 * Экран устарел: планировку удалили или блоку создали список. Строки (а то и всей панели) после
 * перечитывания уже не будет — ответ показывает вкладка (UnitsNotice), а не строка.
 */
export type StaleAvailability = "notFound" | "listExists";

const EMPTY: AvailabilityState = { pending: {}, saved: {}, errors: {}, last: null };
const NETWORK = unitsFailure("network");
const STALE: readonly ContentErrorCode[] = ["notFound", "listExists"] satisfies StaleAvailability[];

const isStale = (error: ContentErrorCode): error is StaleAvailability => STALE.includes(error);

const without = <T>(record: Readonly<Record<string, T>>, keep: (id: string) => boolean) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => keep(id)));

/** Планировки, чей ответ ещё не пришёл, — вне рендера (обработчик видит их сразу, без перерисовки). */
class InFlight {
  private readonly ids = new Set<string>();

  /** false — уже сохраняется. */
  start(id: string): boolean {
    if (this.ids.has(id)) return false;
    this.ids.add(id);
    return true;
  }

  end(id: string) {
    this.ids.delete(id);
  }
}

const valuesOf = (layouts: readonly UnitsLayout[]) =>
  Object.fromEntries(layouts.map((layout) => [layout.id, layout.available]));

export function useLayoutAvailability(
  layouts: readonly UnitsLayout[],
  action: UnitsAction<SetLayoutAvailableInput, ChangedResult>,
  onStale: (reason: StaleAvailability) => void,
) {
  const router = useRouter();
  const [state, setState] = useState(EMPTY);
  useFreshValues(layouts, setState);
  const [inFlight] = useState(() => new InFlight());

  const valueOf = (layout: UnitsLayout) =>
    state.pending[layout.id] ?? state.saved[layout.id] ?? layout.available;

  const change = useCallback(
    async (layout: UnitsLayout, available: boolean) => {
      // Второй тап, пока первый не ответил, не отправляется: ответы пришли бы не по порядку.
      if (!inFlight.start(layout.id)) return;
      setState((current) => ({
        ...current,
        pending: { ...current.pending, [layout.id]: available },
        errors: without(current.errors, (id) => id !== layout.id),
      }));
      const result = await settle(() => action({ layoutId: layout.id, available }), NETWORK);
      inFlight.end(layout.id);
      setState((current) => settled(current, layout.id, available, result));
      if (result.status === "error" && isStale(result.error)) {
        onStale(result.error);
        router.refresh();
      }
    },
    [action, inFlight, onStale, router],
  );

  return { valueOf, change, state };
}

/**
 * Страница перерисовалась с другим наличием из базы (updateTag, правка другого сотрудника):
 * подтверждённое больше не нужно, а отказ у планировки, чьё значение сменилось, устарел — кнопка
 * уже показывает новое. Сравнение по значениям: новый массив с теми же данными — не повод.
 */
function useFreshValues(
  layouts: readonly UnitsLayout[],
  setState: (update: (current: AvailabilityState) => AvailabilityState) => void,
) {
  const [seen, setSeen] = useState(() => valuesOf(layouts));
  const changed = layouts.filter((layout) => seen[layout.id] !== layout.available);
  if (changed.length > 0 || Object.keys(seen).length !== layouts.length) {
    setSeen(valuesOf(layouts));
    const ids = new Set(changed.map((layout) => layout.id));
    setState((current) => ({
      ...current,
      saved: {},
      errors: without(current.errors, (id) => !ids.has(id)),
    }));
  }
}

function settled(
  current: AvailabilityState,
  layoutId: string,
  available: boolean,
  result: ChangedResult,
): AvailabilityState {
  const pending = without(current.pending, (id) => id !== layoutId);
  if (result.status === "error") {
    if (isStale(result.error)) return { ...current, pending };
    return { ...current, pending, errors: { ...current.errors, [layoutId]: result.error } };
  }
  return {
    ...current,
    pending,
    saved: { ...current.saved, [layoutId]: available },
    last: { layoutId, available },
  };
}
