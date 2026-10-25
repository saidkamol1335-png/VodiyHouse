"use client";

import { Check, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { type Ref } from "react";
import { useSiteContacts } from "@/components/SiteContacts";
import type { LeadType } from "@/lib/leads/types";

type LeadDoneProps = {
  type: LeadType;
  number: number;
  repeat: boolean;
  ref: Ref<HTMLDivElement>;
};

/** «Заявка отправлена» мокапа (`.done`): значок, номер, когда перезвонят, «что дальше». */
export function LeadDone({ type, number, repeat, ref }: LeadDoneProps) {
  const t = useTranslations("lead");
  const { callbackMinutes } = useSiteContacts();
  // Просмотр: «перезвонит в течение N минут», а «что дальше» — «подтвердит время» (не повторяем).
  const when = callbackMinutes ? t("doneCall", { minutes: callbackMinutes }) : t("doneCallPlain");
  return (
    <div ref={ref} className="lead-form__done" role="status" tabIndex={-1}>
      <span className="lead-form__done-icon">
        <Check aria-hidden="true" />
      </span>
      <b className="lead-form__done-title">{t("done")}</b>
      {/* Ловушка для ботов отвечает без номера — заявки нет. */}
      {number > 0 ? <p className="lead-form__done-number">{t("doneNumber", { number })}</p> : null}
      <p className="lead-form__done-text">{repeat ? t("doneRepeat") : when}</p>
      <LeadNext type={type} />
    </div>
  );
}

/** «Что дальше» (ТЗ 10.2): под формой и после отправки; минуты — из «Настройки → Контакты». */
export function LeadNext({ type }: { type: LeadType }) {
  const t = useTranslations("lead");
  const { callbackMinutes } = useSiteContacts();
  const text =
    type === "view"
      ? t("nextView")
      : callbackMinutes
        ? t("nextMinutes", { minutes: callbackMinutes })
        : t("next");
  return (
    <p className="lead-form__next">
      <Info size={16} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
