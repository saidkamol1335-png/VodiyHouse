import type { ReactNode } from "react";

/** Уровень заголовка вопроса: на /podbor — 2 (под h1 страницы), в разделе главной — 3 (под h2 раздела). */
export type QuizTitleLevel = 2 | 3;

export function QuizTitle({ level, children }: { level: QuizTitleLevel; children: ReactNode }) {
  const Tag = level === 2 ? "h2" : "h3";
  return <Tag className="quiz__question">{children}</Tag>;
}
