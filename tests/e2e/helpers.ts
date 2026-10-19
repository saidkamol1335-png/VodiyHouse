import type { Page } from "@playwright/test";

/** Ошибки консоли и необработанные исключения страницы. «Готово» — только при пустом списке. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export const PUBLIC_PAGES = ["/uz", "/ru"] as const;
