import type { AdminTab } from "@/components/AdminTabs";
import type { StaffRole } from "../access";
import type { PublicationStatus } from "../publication";

// Вкладки ЖК (экран 3, PLAN §10 п. 21) — отдельные адреса: работает «назад», ссылку на вкладку
// можно отправить.
export const COMPLEX_TABS = [
  { key: "main", segment: null },
  // Описание RU/UZ, детали проекта, видео, частые вопросы.
  { key: "about", segment: "o-zhk" },
  { key: "blocks", segment: "bloki" },
  { key: "layouts", segment: "planirovki" },
  { key: "photos", segment: "foto" },
  // Карта, адрес, «Что рядом».
  { key: "location", segment: "raspolozhenie" },
  // Документы с датами проверки и визит сотрудника.
  { key: "documents", segment: "dokumenty" },
  // Чек-лист 6 пунктов, состояние на сайте, кнопки по роли, предпросмотр 390/1440, журнал.
  { key: "publication", segment: "publikatsiya" },
] as const;

export type ComplexTabKey = (typeof COMPLEX_TABS)[number]["key"];

/**
 * Квартиры (экран 4, п. 22) — не вкладка, а свой экран ЖК: список ↔ фасад с переключателем
 * блоков. Адреса — сегменты страницы ЖК.
 */
export const UNITS_SCREEN = { list: "kvartiry", facade: "fasad" } as const;
export type ComplexScreenKey = ComplexTabKey | "units" | "facade";

/**
 * Мастер «Новый ЖК» (решение фазы 3): у черновика вкладки — шаги с номером и «Далее →»;
 * последний шаг — «Публикация» с чек-листом и кнопкой по роли.
 */
export const WIZARD_STEPS: readonly ComplexTabKey[] = COMPLEX_TABS.map((tab) => tab.key);

export type WizardStep = { segment: string | null; href: string; next: string };

/** Шаги мастера для «Далее →»: адрес вкладки и подпись кнопки, которая ведёт на неё. */
export function wizardSteps(base: string, next: (key: ComplexTabKey, step: number) => string): WizardStep[] {
  return WIZARD_STEPS.map((key, index) => ({
    segment: COMPLEX_TABS.find((tab) => tab.key === key)!.segment,
    href: complexTabHref(base, key),
    next: next(key, index + 1),
  }));
}

export function complexTabHref(base: string, key: ComplexScreenKey): string {
  if (key === "units") return `${base}/${UNITS_SCREEN.list}`;
  if (key === "facade") return `${base}/${UNITS_SCREEN.facade}`;
  const tab = COMPLEX_TABS.find((item) => item.key === key)!;
  return tab.segment ? `${base}/${tab.segment}` : base;
}

/**
 * Что роль делает с ЖК (PLAN §10, п. 6). manage — создаёт ЖК и правит все вкладки и квартиры
 * (руководитель и менеджер); publish — публикует, скрывает, архивирует, удаляет, ставит порядок
 * каталога и отвечает на запросы (руководитель). tabs[0] — куда ведёт строка списка.
 */
export type ComplexAccess = { manage: boolean; publish: boolean; tabs: readonly ComplexTabKey[] };

const ALL_TABS = COMPLEX_TABS.map((tab) => tab.key);

const ACCESS: Record<StaffRole, ComplexAccess> = {
  head: { manage: true, publish: true, tabs: ALL_TABS },
  manager: { manage: true, publish: false, tabs: ALL_TABS },
  mobilographer: { manage: false, publish: false, tabs: [] },
};

export function complexAccess(role: StaffRole): ComplexAccess {
  return ACCESS[role];
}

/**
 * Архив — корзина руководителя (30 дней): без publish архивный ЖК не открывается и по ссылке —
 * в списке у менеджера архива нет (М1).
 */
export function canOpenComplex(access: ComplexAccess, status: PublicationStatus): boolean {
  return access.publish || (access.manage && status !== "archived");
}

/** Адрес экрана, который роль может открыть вместо этого; null — этот открыт (или нет ни одного). */
export function complexTabRedirect(
  role: StaffRole,
  base: string,
  key: ComplexScreenKey,
): string | null {
  const { tabs } = complexAccess(role);
  const first = tabs[0];
  if (!first) return null;
  if (key === "units" || key === "facade") return null;
  return tabs.includes(key) ? null : complexTabHref(base, first);
}

/**
 * attention — на вкладке не хватает данных для публикации (янтарная точка, И9); wizard — черновик:
 * шаги мастера с номером («3. Блоки и оплата»).
 */
export function complexTabs(
  base: string,
  label: (key: ComplexTabKey) => string,
  attention: ReadonlySet<ComplexTabKey> = new Set(),
  wizard = false,
): AdminTab[] {
  return COMPLEX_TABS.map((tab) => {
    const step = wizard ? WIZARD_STEPS.indexOf(tab.key) + 1 : 0;
    return {
      segment: tab.segment,
      href: complexTabHref(base, tab.key),
      label: step > 0 ? `${step}. ${label(tab.key)}` : label(tab.key),
      attention: attention.has(tab.key),
    };
  });
}
