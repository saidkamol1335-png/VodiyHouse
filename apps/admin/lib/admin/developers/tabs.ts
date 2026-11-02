import type { AdminTab } from "@/components/AdminTabs";

// Вкладки застройщика (Д2) — отдельные адреса: работает «назад», ссылку на вкладку можно отправить.
export const DEVELOPER_TABS = [
  { key: "main", segment: null },
  { key: "projects", segment: "obyekty" },
  { key: "private", segment: "vnutrennee" },
  { key: "log", segment: "zhurnal" },
] as const;

export type DeveloperTabKey = (typeof DEVELOPER_TABS)[number]["key"];

export function developerTabs(base: string, label: (key: DeveloperTabKey) => string): AdminTab[] {
  return DEVELOPER_TABS.map((tab) => ({
    segment: tab.segment,
    href: tab.segment ? `${base}/${tab.segment}` : base,
    label: label(tab.key),
  }));
}
