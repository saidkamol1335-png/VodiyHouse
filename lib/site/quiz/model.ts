import { NO_FILTER, type CatalogFilter, type PaymentKind } from "@/lib/site/catalog/filter";
import { countMatchingFlats } from "@/lib/site/catalog/flats";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { filterCatalog, matchingPriceUsd } from "@/lib/site/catalog/sort";

// Квиз «Подбор за 1 минуту» (3.17, мокап .qz / MobQuiz): четыре вопроса → фильтр каталога.
// Живой счётчик считает по тем же правилам, что и выдача (filterCatalog), поэтому «Показать N ЖК»
// открывает ровно те же N. Ответы без условия («не важно», «пока не знаю») фильтр не трогают.

/** Чипы комнат — как в каталоге: 0 — студия, 4 — «4+». */
export const QUIZ_ROOMS = [0, 1, 2, 3, 4] as const;
/** «до $30k … до $80k»; 0 — «не важно». */
export const QUIZ_BUDGETS = [30_000, 45_000, 60_000, 80_000, 0] as const;
export const QUIZ_PAYMENTS = ["full", "inst", "bank", "mort", "unsure"] as const;
export const QUIZ_WHEN = ["now", "year", "later", "any"] as const;

export type QuizRoom = (typeof QUIZ_ROOMS)[number];
export type QuizBudget = (typeof QUIZ_BUDGETS)[number];
export type QuizPayment = (typeof QUIZ_PAYMENTS)[number];
export type QuizWhen = (typeof QUIZ_WHEN)[number];

export type QuizAnswers = {
  rooms: QuizRoom[];
  budget: QuizBudget | null;
  payment: QuizPayment | null;
  when: QuizWhen | null;
};

export const EMPTY_ANSWERS: QuizAnswers = { rooms: [], budget: null, payment: null, when: null };

/** Вопросов — четыре; пятый шаг — контакты («Вопрос 5 из 5»). */
export const QUIZ_QUESTIONS = 4;
export const QUIZ_STEPS = QUIZ_QUESTIONS + 1;
export const CONTACT_STEP = QUIZ_QUESTIONS;

/** Комнат можно выбрать несколько: повторное нажатие снимает. */
export function toggleRoom(rooms: readonly QuizRoom[], room: QuizRoom): QuizRoom[] {
  return rooms.includes(room) ? rooms.filter((value) => value !== room) : [...rooms, room].sort((a, b) => a - b);
}

/** Срок: «сразу» — сданные, «в течение года» — до следующего года, «через 1–2 года» — ещё на год позже.
 *  Дата читается только когда она нужна: при первом рендере ответа нет, и prerender не трогает часы. */
export function deadlineOf(when: QuizWhen | null, now?: Date): CatalogFilter["deadline"] {
  if (when === "now") return "built";
  if (when === "year") return (now ?? new Date()).getFullYear() + 1;
  if (when === "later") return (now ?? new Date()).getFullYear() + 2;
  return "any";
}

export function quizFilter(answers: QuizAnswers, now?: Date): CatalogFilter {
  const payment: PaymentKind[] = answers.payment && answers.payment !== "unsure" ? [answers.payment] : [];
  return {
    ...NO_FILTER,
    rooms: [...answers.rooms].sort((a, b) => a - b),
    priceMax: answers.budget || null,
    payments: payment,
    deadline: deadlineOf(answers.when, now),
  };
}

export type QuizMatch = {
  /** Подходящие ЖК — дешевле первыми (мокап matchMin). */
  complexes: CatalogComplex[];
  /** Свободных подходящих квартир; partial — у части типов наличие без числа: тогда «не меньше». */
  flats: number;
  partial: boolean;
  /** Цена «от» в $ по подходящим типам — подпись миниатюры; null — неизвестна. */
  prices: Map<string, number | null>;
};

export function quizMatches(catalog: SiteCatalog, filter: CatalogFilter): QuizMatch {
  const complexes = filterCatalog(catalog, { ...filter, sort: "cheap" });
  const { flats, partial } = countMatchingFlats(complexes, catalog, filter);
  const prices = new Map(complexes.map((complex) => [complex.id, matchingPriceUsd(complex, catalog, filter)]));
  return { complexes, flats, partial, prices };
}
