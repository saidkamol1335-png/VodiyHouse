import type { useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import type { QuizAnswers } from "@/lib/site/quiz/model";

export type QuizTranslator = ReturnType<typeof useTranslations<"quiz">>;

/** «до $45 000» — подпись варианта бюджета и ответа. */
export const budgetLabel = (t: QuizTranslator, budget: number) => t("upTo", { price: formatPrice(budget, "USD") });

/**
 * Ответы словами — бейджи над контактами и текст заявки менеджеру: «2-комн., 3-комн. · до $45 000 ·
 * Рассрочка · В течение года»; ответы без условия тоже видны («бюджет любой»).
 */
export function answerLabels(answers: QuizAnswers, t: QuizTranslator): string[] {
  const labels: string[] = [];
  if (answers.rooms.length > 0) labels.push(answers.rooms.map((room) => t(`rooms.${room}`)).join(", "));
  if (answers.budget !== null) labels.push(answers.budget ? budgetLabel(t, answers.budget) : t("answers.budgetAny"));
  if (answers.payment) labels.push(answers.payment === "unsure" ? t("answers.paymentUnsure") : t(`payments.${answers.payment}`));
  if (answers.when) labels.push(answers.when === "any" ? t("answers.whenAny") : t(`when.${answers.when}`));
  return labels;
}
