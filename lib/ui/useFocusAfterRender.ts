"use client";

import { useEffect, useState } from "react";

// Кнопка, которую нажали, исчезла вместе со строкой («Убрать строку», «Разделить по этажам»), и
// фокус упал бы на body (WCAG 2.4.3). Обработчик просит фокус на элемент новой разметки по id —
// его ставят после перерисовки. Объект в useState: читается из обработчиков и эффекта, не из рендера.

class FocusRequest {
  private id: string | null = null;

  ask = (id: string) => {
    this.id = id;
  };

  flush() {
    if (this.id === null) return;
    document.getElementById(this.id)?.focus({ preventScroll: false });
    this.id = null;
  }
}

/** Возвращает «поставь фокус на id после перерисовки». */
export function useFocusAfterRender(): (id: string) => void {
  const [request] = useState(() => new FocusRequest());
  useEffect(() => request.flush());
  return request.ask;
}
