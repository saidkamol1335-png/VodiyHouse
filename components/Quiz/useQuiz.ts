"use client";

import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { getPathname } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { searchFromFilter } from "@/lib/site/catalog/params";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import {
  CONTACT_STEP,
  EMPTY_ANSWERS,
  quizFilter,
  quizMatches,
  toggleRoom,
  type QuizAnswers,
  type QuizRoom,
} from "@/lib/site/quiz/model";

type SingleAnswer = Exclude<keyof QuizAnswers, "rooms">;

/**
 * Состояние анкеты: шаг (0–3 — вопросы, 4 — контакты), ответы, фильтр и живой счётчик по каталогу
 * (без каталога счётчика нет — анкета всё равно работает), ссылка на подходящие ЖК в каталоге.
 */
export function useQuiz(catalog: SiteCatalog | null) {
  const locale = useLocale() as Locale;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>(EMPTY_ANSWERS);
  const filter = useMemo(() => quizFilter(answers), [answers]);
  const match = useMemo(() => (catalog ? quizMatches(catalog, filter) : null), [catalog, filter]);
  const catalogHref = getPathname({ href: ROUTES.catalog, locale });
  const link = `${catalogHref}${searchFromFilter(filter)}`;

  const back = () => setStep((current) => Math.max(0, current - 1));
  const next = () => setStep((current) => Math.min(CONTACT_STEP, current + 1));
  const toggle = (room: QuizRoom) => setAnswers((current) => ({ ...current, rooms: toggleRoom(current.rooms, room) }));
  /** Один вариант — и сразу следующий вопрос (мокап). */
  const answer = <Key extends SingleAnswer>(key: Key, value: QuizAnswers[Key]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    next();
  };
  const restart = () => {
    setAnswers(EMPTY_ANSWERS);
    setStep(0);
  };
  return { step, answers, filter, match, link, catalogHref, back, next, toggle, answer, restart };
}

export type QuizState = ReturnType<typeof useQuiz>;
