import type { AdminTab } from "@/components/AdminTabs";
import type { StaffRole } from "../access";
import type { PublicationStatus } from "../publication";

// Вкладки ЖК (решение в. 6) — отдельные адреса: работает «назад», ссылку на вкладку можно отправить.
export const COMPLEX_TABS = [
  { key: "main", segment: null },
  { key: "blocks", segment: "bloki" },
  { key: "layouts", segment: "planirovki" },
  { key: "units", segment: "kvartiry" },
  { key: "photos", segment: "foto" },
  // Фаза 4: фасад с контурами блоков и планы этажей — раздел «Выбрать квартиру» на сайте.
  { key: "facade", segment: "fasad" },
  // Шаг 3.5 (Ф4): разделы страницы ЖК сверх мокапа — в порядке страницы; без данных их не видно.
  { key: "videos", segment: "video" },
  { key: "details", segment: "detali" },
  { key: "documents", segment: "dokumenty" },
  // Шаг 3.6: настоящая страница ЖК в режиме предпросмотра (draftMode) — последний шаг мастера.
  { key: "preview", segment: "predprosmotr" },
  { key: "log", segment: "zhurnal" },
] as const;

export type ComplexTabKey = (typeof COMPLEX_TABS)[number]["key"];

/**
 * Мастер «Новый ЖК» (решение фазы 3): у черновика вкладки — шаги с номером и «Далее →», после
 * предпросмотра — «Опубликовать» в шапке. «Журнал» — не шаг; «Фасад и планы» (фаза 4) — тоже:
 * раздел необязательный, без него ЖК публикуется.
 */
const NOT_STEPS: readonly ComplexTabKey[] = ["facade", "log"];
export const WIZARD_STEPS: readonly ComplexTabKey[] = COMPLEX_TABS.map((tab) => tab.key).filter((key) => !NOT_STEPS.includes(key));

export type WizardStep = { segment: string | null; href: string; next: string };

/** Шаги мастера для «Далее →»: адрес вкладки и подпись кнопки, которая ведёт на неё. */
export function wizardSteps(base: string, next: (key: ComplexTabKey, step: number) => string): WizardStep[] {
  return WIZARD_STEPS.map((key, index) => ({
    segment: COMPLEX_TABS.find((tab) => tab.key === key)!.segment,
    href: complexTabHref(base, key),
    next: next(key, index + 1),
  }));
}

export function complexTabHref(base: string, key: ComplexTabKey): string {
  const tab = COMPLEX_TABS.find((item) => item.key === key)!;
  return tab.segment ? `${base}/${tab.segment}` : base;
}

/**
 * Что роль делает с ЖК (Н2). manage — создание, статус публикации и все вкладки (руководитель);
 * менеджер ведёт только наличие: тот же список без создания и статусов → сразу «Квартиры».
 * tabs[0] — куда ведёт строка списка; закрытая вкладка по адресу перекидывает туда же.
 */
export type ComplexAccess = { manage: boolean; tabs: readonly ComplexTabKey[] };

const ACCESS: Record<StaffRole, ComplexAccess> = {
  head: { manage: true, tabs: COMPLEX_TABS.map((tab) => tab.key) },
  manager: { manage: false, tabs: ["units"] },
  videographer: { manage: false, tabs: [] },
};

export function complexAccess(role: StaffRole): ComplexAccess {
  return ACCESS[role];
}

/**
 * Архив — корзина руководителя (30 дней): без manage архивный ЖК не открывается и по ссылке —
 * в списке его нет (М1), а без капсулы статуса менеджер не узнал бы, что правит архив.
 */
export function canOpenComplex(access: ComplexAccess, status: PublicationStatus): boolean {
  return access.manage || status !== "archived";
}

/** Адрес вкладки, которую роль может открыть вместо этой; null — эта открыта (или нет ни одной). */
export function complexTabRedirect(
  role: StaffRole,
  base: string,
  key: ComplexTabKey,
): string | null {
  const { tabs } = complexAccess(role);
  const first = tabs[0];
  if (!first || tabs.includes(key)) return null;
  return complexTabHref(base, first);
}

/**
 * attention — на вкладке не хватает данных для публикации (янтарная точка, И9); wizard — черновик:
 * шаги мастера с номером («3. Планировки»).
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
