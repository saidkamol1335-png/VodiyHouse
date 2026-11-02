"use client";

import { useCallback, useEffect, useState } from "react";

// Кнопка, которую нажали, исчезла вместе со строкой («Убрать строку», «Разделить по этажам»), или
// ответ показал ошибку у поля — фокус упал бы на body (WCAG 2.4.3) или остался на кнопке, и диктор
// не услышал бы причину. Обработчик просит фокус — его ставят после коммита компонента (эффект),
// а не в кадре: до коммита на странице ещё прежняя разметка (удаляемая строка, старое поле).
// Запрос сам перерисовывает владельца: при отказе до запроса ошибку уже отрисовал коммит события
// (SyncLane), раньше чем дошло .then с запросом, — без своего рендера эффект бы не повторился.
// Цель ищется один раз, в коммите самого запроса: не нашлась (успех без ошибок) — фокус не
// перехватит потом, посреди ввода. Срок FOCUS_WINDOW_MS — страховка для вкладки, спрятанной
// в Activity: там эффекты стоят до показа, и фокус прыгнул бы при возврате «Назад».
// Объект в useState: читается из обработчиков и эффекта.

const FOCUS_WINDOW_MS = 1000;

type Target = () => HTMLElement | null;

class FocusRequest {
  private target: Target | null = null;
  private asked = 0;
  private askedAt = 0;

  /** Номер запроса — его отрисовка ставит фокус. */
  ask = (target: Target): number => {
    this.target = target;
    this.askedAt = Date.now();
    this.asked += 1;
    return this.asked;
  };

  /** rendered — номер последнего запроса, попавшего в этот коммит. */
  flush(rendered: number) {
    if (this.target === null || rendered < this.asked) return;
    if (Date.now() - this.askedAt <= FOCUS_WINDOW_MS) this.target()?.focus();
    this.target = null;
  }
}

function useFocusRequest(): (target: Target) => void {
  const [request] = useState(() => new FocusRequest());
  const [rendered, setRendered] = useState(0);
  useEffect(() => request.flush(rendered));
  return useCallback((target: Target) => setRendered(request.ask(target)), [request]);
}

/** «Поставь фокус на первый существующий из id после перерисовки». */
export function useFocusAfterRender(): (...ids: string[]) => void {
  const ask = useFocusRequest();
  return useCallback(
    (...ids: string[]) =>
      ask(() => {
        for (const id of ids) {
          const element = document.getElementById(id);
          if (element) return element;
        }
        return null;
      }),
    [ask],
  );
}

/**
 * Отказ до запроса (поле пустое, место занято) или отказ базы по своему полю: фокус — на первое
 * неверное поле формы ([aria-invalid]), оно связано с текстом ошибки. Возврат фокуса на кнопку
 * (useRefocusAfter) — очистка эффекта того же коммита, она отрабатывает раньше.
 */
export function useFocusFirstInvalid(): (form: HTMLElement) => void {
  const ask = useFocusRequest();
  return useCallback(
    (form: HTMLElement) => ask(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')),
    [ask],
  );
}
