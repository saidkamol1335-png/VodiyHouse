"use client";

import { useTranslations } from "next-intl";
import { Beam } from "@/components/Beam";
import { Eyebrow } from "@/components/Eyebrow";
import { LeadForm, type LeadIntent } from "@/components/LeadForm";
import { useReveal } from "@/lib/motion";

/**
 * «Хотите узнать больше?» в конце страницы ЖК (ТЗ 10.1, мокап: .card.beam .grid2): слева обещание,
 * справа форма — имя, телефон и язык общения; заявка «по ЖК».
 */
export function LeadMore({ intent }: { intent: LeadIntent }) {
  const t = useTranslations("lead.more");
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} className="lead-more" aria-labelledby="lead-more-title">
      <Beam />
      <div className="lead-more__text">
        <Eyebrow>Vodiy House</Eyebrow>
        <h2 id="lead-more-title" className="heading heading--h2 lead-more__title">
          {t.rich("title", { accent: (chunks) => <span className="heading__accent">{chunks}</span> })}
        </h2>
        <p className="lead-more__lead">{t("text")}</p>
      </div>
      <LeadForm id="lead-more" intent={intent} variant="inline" />
    </section>
  );
}
