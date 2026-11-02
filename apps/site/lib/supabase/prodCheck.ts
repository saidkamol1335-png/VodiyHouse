// Проверка прода (`cloud:check -- --prod`): DEMO и следы проверок — ошибка (решение 02.11.2026).
import { fail, manual, ok, type CheckLine } from "./cloudCheck";

export type ProdState = {
  demoComplexes: number | null;
  /** Сотрудники e2e-…@example.com в Auth. */
  e2eUsers: number | null;
  leads: number | null;
  /** Следующий номер заявки (счётчик identity). */
  nextLeadNumber: number | null;
  /** Опубликованные ЖК, у которых не выполнен минимум (site_state = 'draft'). */
  incompletePublished: string[] | null;
  rate: boolean | null;
};

type Rule<K extends keyof ProdState> = (value: NonNullable<ProdState[K]>) => CheckLine;

const RULES: { [K in keyof ProdState]: Rule<K> } = {
  demoComplexes: (n) =>
    n === 0
      ? ok("DEMO нет")
      : fail(`DEMO в проде: ЖК ${n}`, "npm run demo:remove — с «да» исполнителя"),
  e2eUsers: (n) =>
    n === 0
      ? ok("сотрудников e2e нет")
      : fail(`сотрудники e2e в проде: ${n}`, "удалить в Authentication → Users"),
  leads: (n) =>
    n === 0
      ? ok("заявок нет")
      : manual(`заявок: ${n}`, "настоящие? тестовые — удалить с «да» исполнителя"),
  nextLeadNumber: (n) =>
    n === 1001
      ? ok("первая заявка получит #1001")
      : manual(`следующая заявка — #${n}`, "сброс счётчика — PROGRESS «Полировка»"),
  incompletePublished: (slugs) =>
    slugs.length === 0
      ? ok("опубликованные ЖК — все с минимумом")
      : fail(`опубликованы без минимума: ${slugs.join(", ")}`, "снять с публикации в кабинете"),
  rate: (has) =>
    has
      ? ok("курс ЦБ записан")
      : manual(
          "курса ЦБ нет",
          "«Программы оплаты» → «Зафиксировать курс» — без него ЖК не опубликовать",
        ),
};

/**
 * Прод: DEMO и следы проверок — ошибка, а не норма тестового облака.
 * null — таблиц ещё нет (до db:push), строка пропускается.
 */
export function checkProd(state: ProdState): CheckLine[] {
  return (Object.keys(RULES) as (keyof ProdState)[]).flatMap((key) => {
    const value = state[key];
    return value === null ? [] : [(RULES[key] as Rule<typeof key>)(value as never)];
  });
}
