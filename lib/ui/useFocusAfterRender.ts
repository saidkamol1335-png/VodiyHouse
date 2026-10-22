"use client";

import { useCallback, useEffect, useState } from "react";

// Кнопка, которую нажали, исчезла вместе со строкой («Убрать строку», «Разделить по этажам»), или
// ответ показал ошибку у поля — фокус упал бы на body (WCAG 2.4.3) или остался на кнопке, и диктор
// не услышал бы причину. Обработчик просит фокус — его ставят после коммита компонента (эффект),
// а не в кадре: до коммита на странице ещё прежняя разметка (удаляемая строка, старое поле с
// ошибкой). Цель, которой так и не случилось (успех без ошибок), не ловит фокус потом: запрос
// живёт FOCUS_WINDOW_MS. Объект в useState: читается из обработчиков и эффекта, не из рендера.

const FOCUS_WINDOW_MS = 1000;

type Target = () => HTMLElement | null;

class FocusRequest {
  private target: Target | null = null;
  private until = 0;

  ask = (target: Target) => {
    this.target = target;
    this.until = Date.now() + FOCUS_WINDOW_MS;
  };

  flush() {
    if (this.target === null) return;
    if (Date.now() > this.until) {
      this.target = null;
      return;
    }
    const element = this.target();
    if (!element) return;
    element.focus();
    this.target = null;
  }
}

function useFocusRequest(): FocusRequest {
  const [request] = useState(() => new FocusRequest());
  useEffect(() => request.flush());
  return request;
}

/** «Поставь фокус на первый существующий из id после перерисовки». */
export function useFocusAfterRender(): (...ids: string[]) => void {
  const request = useFocusRequest();
  return useCallback(
    (...ids: string[]) =>
      request.ask(() => {
        for (const id of ids) {
          const element = document.getElementById(id);
          if (element) return element;
        }
        return null;
      }),
    [request],
  );
}

/**
 * Отказ до запроса (поле пустое, место занято) или отказ базы по своему полю: фокус — на первое
 * неверное поле формы ([aria-invalid]), оно связано с текстом ошибки. Возврат фокуса на кнопку
 * (useRefocusAfter) — очистка эффекта того же коммита, она отрабатывает раньше.
 */
export function useFocusFirstInvalid(): (form: HTMLElement) => void {
  const request = useFocusRequest();
  return useCallback(
    (form: HTMLElement) =>
      request.ask(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')),
    [request],
  );
}
