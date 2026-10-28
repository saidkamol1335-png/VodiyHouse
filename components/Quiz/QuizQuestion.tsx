"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { QUIZ_BUDGETS, QUIZ_PAYMENTS, QUIZ_ROOMS, QUIZ_WHEN } from "@/lib/site/quiz/model";
import { budgetLabel } from "./answers";
import { QuizTitle, type QuizTitleLevel } from "./QuizTitle";
import type { QuizState } from "./useQuiz";

type OptionProps = { label: string; on: boolean; onClick: () => void; index: number };

/** Вариант ответа (мокап .qopt): подпись и кружок с галочкой; выбранный — янтарный. */
function Option({ label, on, onClick, index }: OptionProps) {
  return (
    <button type="button" className={on ? "quiz__option quiz__option--on" : "quiz__option"} aria-pressed={on} onClick={onClick} style={{ ["--i" as string]: index }}>
      <span>{label}</span>
      <i aria-hidden="true">
        <Check size={14} strokeWidth={2.5} />
      </i>
    </button>
  );
}

/** Назад (кроме первого вопроса); у комнат — «Дальше» / «Пропустить», остальные идут дальше сами. */
function Nav({ quiz, children }: { quiz: QuizState; children?: ReactNode }) {
  const t = useTranslations("quiz");
  return (
    <div className="quiz__nav">
      {quiz.step > 0 ? (
        <Button variant="ghost" size="sm" onClick={quiz.back}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </Button>
      ) : null}
      <span className="quiz__nav-gap" />
      {children}
    </div>
  );
}

type QuestionProps = { quiz: QuizState; level: QuizTitleLevel };

/** Вопрос 1 — комнаты: можно несколько; «Дальше», а без выбора — «Пропустить». */
function RoomsQuestion({ quiz, level }: QuestionProps) {
  const t = useTranslations("quiz");
  const picked = quiz.answers.rooms.length > 0;
  return (
    <>
      <QuizTitle level={level}>{t("questions.rooms")}</QuizTitle>
      <p className="quiz__hint">{t("multi")}</p>
      <div className="quiz__options">
        {QUIZ_ROOMS.map((room, index) => (
          <Option key={room} index={index} label={t(`rooms.${room}`)} on={quiz.answers.rooms.includes(room)} onClick={() => quiz.toggle(room)} />
        ))}
      </div>
      <Nav quiz={quiz}>
        <Button variant={picked ? "primary" : "outline"} size="sm" onClick={quiz.next}>
          {picked ? t("next") : t("skip")}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
      </Nav>
    </>
  );
}

type SingleChoiceProps<Option extends string | number> = QuestionProps & {
  question: "budget" | "payment" | "when";
  options: readonly Option[];
  value: Option | null;
  label: (option: Option) => string;
  onPick: (option: Option) => void;
};

/** Вопросы 2–4: один вариант, выбор сразу ведёт к следующему вопросу (useQuiz.answer). */
function SingleChoice<Option extends string | number>({ quiz, level, question, options, value, label, onPick }: SingleChoiceProps<Option>) {
  const t = useTranslations("quiz");
  return (
    <>
      <QuizTitle level={level}>{t(`questions.${question}`)}</QuizTitle>
      <div className="quiz__options">
        {options.map((option, index) => (
          <Option key={option} index={index} label={label(option)} on={value === option} onClick={() => onPick(option)} />
        ))}
      </div>
      <Nav quiz={quiz} />
    </>
  );
}

/** Вопросы 1–4 (мокап .qz__q / .qz__opts): комнаты — несколько, остальные — один вариант. */
export function QuizQuestion({ quiz, level }: QuestionProps) {
  const t = useTranslations("quiz");
  const { answers } = quiz;
  if (quiz.step === 0) return <RoomsQuestion quiz={quiz} level={level} />;
  if (quiz.step === 1) {
    const label = (budget: (typeof QUIZ_BUDGETS)[number]) => (budget ? budgetLabel(t, budget) : t("any"));
    return <SingleChoice quiz={quiz} level={level} question="budget" options={QUIZ_BUDGETS} value={answers.budget} label={label} onPick={(budget) => quiz.answer("budget", budget)} />;
  }
  if (quiz.step === 2) {
    return <SingleChoice quiz={quiz} level={level} question="payment" options={QUIZ_PAYMENTS} value={answers.payment} label={(payment) => t(`payments.${payment}`)} onPick={(payment) => quiz.answer("payment", payment)} />;
  }
  return <SingleChoice quiz={quiz} level={level} question="when" options={QUIZ_WHEN} value={answers.when} label={(when) => t(`when.${when}`)} onPick={(when) => quiz.answer("when", when)} />;
}
