"use client";

import { ArrowRight, Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { useSiteContacts } from "@/components/SiteContacts";
import { ROUTES } from "@/lib/routes";
import type { QuizMatch } from "@/lib/site/quiz/model";

type QuizDoneProps = {
  number: number;
  match: QuizMatch | null;
  link: string;
  onRestart: () => void;
};

/**
 * «Подборка готова» (мокап .done): номер заявки, «менеджер пришлёт в Telegram в течение N минут»
 * (N — «Настройки → Контакты», без него — без срока), «Показать N ЖК» → каталог с фильтром
 * (ничего не подошло — все новостройки), «Пройти заново».
 */
export function QuizDone({ number, match, link, onRestart }: QuizDoneProps) {
  const t = useTranslations("quiz");
  const tl = useTranslations("lead");
  const { callbackMinutes } = useSiteContacts();
  const total = match?.complexes.length ?? 0;
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => done.current?.focus(), []);
  const text = match && total === 0 ? t("doneNone") : callbackMinutes ? t("doneMinutes", { minutes: callbackMinutes }) : t("done");
  return (
    <div ref={done} className="quiz__done" role="status" tabIndex={-1}>
      <span className="quiz__done-icon">
        <Check aria-hidden="true" />
      </span>
      <b className="quiz__done-title">{t("doneTitle")}</b>
      {/* Ловушка для ботов отвечает без номера — заявки нет. */}
      {number > 0 ? <p className="quiz__done-number">{tl("doneNumber", { number })}</p> : null}
      <p className="quiz__done-text">{text}</p>
      <div className="quiz__done-actions">
        <Button href={total > 0 ? link : ROUTES.catalog}>
          {total > 0 ? t("show", { count: total }) : t("showAll")}
          <ArrowRight size={16} aria-hidden="true" />
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden="true" />
          {t("again")}
        </Button>
      </div>
    </div>
  );
}
