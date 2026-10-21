import type { AdminTab } from "@/components/AdminTabs";

// Вкладки ЖК (решение в. 6) — отдельные адреса: работает «назад», ссылку на вкладку можно отправить.
export const COMPLEX_TABS = [
  { key: "main", segment: null },
  { key: "blocks", segment: "bloki" },
  { key: "layouts", segment: "planirovki" },
  { key: "units", segment: "kvartiry" },
  { key: "photos", segment: "foto" },
  { key: "log", segment: "zhurnal" },
] as const;

export type ComplexTabKey = (typeof COMPLEX_TABS)[number]["key"];

export function complexTabHref(base: string, key: ComplexTabKey): string {
  const tab = COMPLEX_TABS.find((item) => item.key === key)!;
  return tab.segment ? `${base}/${tab.segment}` : base;
}

/** attention — на вкладке не хватает данных для публикации (янтарная точка, И9). */
export function complexTabs(
  base: string,
  label: (key: ComplexTabKey) => string,
  attention: ReadonlySet<ComplexTabKey> = new Set(),
): AdminTab[] {
  return COMPLEX_TABS.map((tab) => ({
    segment: tab.segment,
    href: complexTabHref(base, tab.key),
    label: label(tab.key),
    attention: attention.has(tab.key),
  }));
}
