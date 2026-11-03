// Проверка прода (`cloud:check -- --prod`): DEMO и следы проверок — ошибка (решение 02.11.2026).
// Только `import type`: скрипт грузит файл в Node без сборщика, а он не подставляет расширение .ts.
import type { CheckLine } from "./cloudCheck";

export type ProdState = {
  /** DEMO: ЖК и застройщики со slug demo-…, заявки «DEMO · …». */
  demo: number | null;
  /** Сотрудники …@example.com в Auth (e2e и спеки). */
  e2eUsers: number | null;
  leads: number | null;
  /** Следующий номер заявки (счётчик identity). */
  nextLeadNumber: number | null;
  /** Опубликованные ЖК, у которых не выполнен минимум (site_state = 'draft'). */
  incompletePublished: string[] | null;
  rate: boolean | null;
};

const ok = (text: string): CheckLine => ({ status: "ok", text });
const fail = (text: string, hint?: string): CheckLine => ({ status: "fail", text, hint });
const manual = (text: string, hint?: string): CheckLine => ({ status: "manual", text, hint });

type Rule<K extends keyof ProdState> = (value: NonNullable<ProdState[K]>) => CheckLine;

const RULES: { [K in keyof ProdState]: Rule<K> } = {
  demo: (n) =>
    n === 0
      ? ok("DEMO нет")
      : fail(`DEMO в проде: записей ${n}`, "npm run demo:remove — с «да» исполнителя"),
  e2eUsers: (n) =>
    n === 0
      ? ok("сотрудников …@example.com нет")
      : fail(`тестовые сотрудники в проде: ${n}`, "удалить в Authentication → Users"),
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
      ? ok("курс записан (ЦБ или ручной)")
      : manual(
          "курса нет",
          "«Программы оплаты» → «Зафиксировать курс» — без него ЖК не опубликовать",
        ),
};

/**
 * Прод: DEMO и следы проверок — ошибка, а не норма тестового облака. null — запрос не прошёл (до
 * db:push или нет прав): на проде это ✗, а не пропуск — иначе «готово» без проверки.
 */
export function checkProd(state: ProdState): CheckLine[] {
  return (Object.keys(RULES) as (keyof ProdState)[]).map((key) => {
    const value = state[key];
    if (value === null)
      return fail(
        `не удалось проверить: ${key}`,
        "сначала db:push; доступ к базе — SUPABASE_DB_URL",
      );
    return (RULES[key] as Rule<typeof key>)(value as never);
  });
}
