"use client";

import { useState } from "react";

/**
 * Состояние, которое ведёт сервер: локальные правки (ответ действия) живут, пока не придут новые
 * пропсы — страница перерисовалась после действия, и правда снова у неё.
 */
export function useSyncedState<T>(source: T) {
  const [value, setValue] = useState(source);
  const [seen, setSeen] = useState(source);
  if (source !== seen) {
    setSeen(source);
    setValue(source);
  }
  return [value, setValue] as const;
}
