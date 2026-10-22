// Отказ до запроса (поле пустое, место занято) или отказ базы по своему полю: кнопка остаётся в
// фокусе, и диктор причину не слышит. Фокус — на первое неверное поле: оно связано с текстом
// ошибки (aria-describedby), его прочтут вместе с ним. После перерисовки: ошибки ставит setState,
// а возврат фокуса на кнопку (useRefocusAfter) — эффект, он отрабатывает раньше кадра.

export function focusFirstInvalid(root: HTMLElement | null): void {
  requestAnimationFrame(() => root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
