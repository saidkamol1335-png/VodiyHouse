"use client";

import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Beam } from "@/components/Beam";
import { Eyebrow } from "@/components/Eyebrow";
import { useLeadSubmit } from "@/components/LeadForm";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { CONTACT_STEP, QUIZ_STEPS, type QuizMatch } from "@/lib/site/quiz/model";
import { answerLabels } from "./answers";
import { QuizContact } from "./QuizContact";
import { QuizDone } from "./QuizDone";
import { QuizLive } from "./QuizLive";
import { QuizQuestion } from "./QuizQuestion";
import { useQuiz } from "./useQuiz";

export type QuizVariant = "home" | "page";

type QuizProps = {
  id: string;
  catalog: SiteCatalog | null;
  /** home — раздел главной (на телефоне только вступление и кнопка на /podbor); page — /podbor. */
  variant: QuizVariant;
};

type QuizIntroProps = { id: string; match: QuizMatch | null; locale: Locale; variant: QuizVariant };

/** Левый столбец: зачем квиз и живой счётчик; на телефоне главной — ещё кнопка на /podbor. */
function QuizIntro({ id, match, locale, variant }: QuizIntroProps) {
  const t = useTranslations("quiz");
  // На /podbor это заголовок страницы (h1), на главной — раздела.
  const Heading = variant === "page" ? "h1" : "h2";
  return (
    <div className="quiz__intro">
      <Eyebrow>{t("eyebrow")}</Eyebrow>
      <Heading id={`${id}-title`} className="heading heading--h2 quiz__title">
        {t("title")}
        <span className="heading__accent">{t("titleAccent")}</span>
      </Heading>
      <p className="quiz__lead">{t("lead")}</p>
      {match ? <QuizLive match={match} locale={locale} /> : null}
      {variant === "home" ? (
        <Link href={ROUTES.quiz} className="quiz__start">
          <Sparkles size={18} aria-hidden="true" />
          {t("start")}
          <span className="quiz__start-note">{t("time")}</span>
        </Link>
      ) : null}
    </div>
  );
}

/** Ширина шкалы: шаг из пяти плюс чуть-чуть с самого начала (мокап pStyle); после отправки — вся. */
const barWidth = (step: number, sent: boolean) => (sent ? 100 : (step / QUIZ_STEPS) * 100 + 4);

/** Шапка карточки: «Вопрос N из 5» (после отправки — «Подборка готова»), время и шкала. */
function QuizProgress({ step, sent }: { step: number; sent: boolean }) {
  const t = useTranslations("quiz");
  return (
    <>
      <div className="quiz__top">
        <span className="quiz__step">{sent ? t("doneTitle") : t("step", { a: step + 1, b: QUIZ_STEPS })}</span>
        <span className="quiz__time">{t("time")}</span>
      </div>
      <div className="quiz__bar" aria-hidden="true">
        <i style={{ width: `${barWidth(step, sent)}%` }} />
      </div>
    </>
  );
}

/**
 * Квиз «Подбор за 1 минуту» (3.17, мокап .qz / MobQuiz): слева — зачем и живой счётчик, справа —
 * карточка с четырьмя вопросами и контактами; заявка `quiz` уходит с ответами словами и ссылкой
 * на подходящие ЖК. Один и тот же компонент на главной и на /podbor.
 */
export function Quiz({ id, catalog, variant }: QuizProps) {
  const t = useTranslations("quiz");
  const locale = useLocale() as Locale;
  const quiz = useQuiz(catalog);
  const labels = answerLabels(quiz.answers, t);
  const lead = useLeadSubmit(`${id}-lead`, {
    type: "quiz",
    quiz: { answers: labels.join(" · "), link: quiz.link, complexes: quiz.match?.complexes.length ?? 0, flats: quiz.match?.flats ?? 0 },
  });
  const sent = lead.sent;
  // На /podbor вопрос — h2 под заголовком страницы, в разделе главной — h3 под заголовком раздела.
  const level = variant === "page" ? 2 : 3;
  const restart = () => {
    lead.reset();
    quiz.restart();
  };
  return (
    <div className={`quiz quiz--${variant}`} data-step={quiz.step} data-sent={sent ? "" : undefined}>
      <QuizIntro id={id} match={quiz.match} locale={locale} variant={variant} />
      <div className="quiz__card">
        <Beam className="quiz__beam" />
        <QuizProgress step={quiz.step} sent={Boolean(sent)} />
        {sent ? (
          <QuizDone number={sent.number} match={quiz.match} link={quiz.link} onRestart={restart} />
        ) : quiz.step < CONTACT_STEP ? (
          <QuizQuestion quiz={quiz} level={level} />
        ) : (
          <QuizContact id={`${id}-lead`} level={level} lang={locale} labels={labels} lead={lead} onBack={quiz.back} />
        )}
      </div>
      {variant === "page" && quiz.match ? (
        <div className="quiz__foot">
          <QuizLive match={quiz.match} locale={locale} compact />
        </div>
      ) : null}
    </div>
  );
}
