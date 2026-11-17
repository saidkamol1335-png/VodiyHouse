import { ChevronDown } from "lucide-react";
import { getLocale } from "next-intl/server";
import type { FaqItem } from "@vh/shared/faq";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/lib/i18n/routing";

/**
 * «Частые вопросы» — один компонент для главной и страницы ЖК (правки 15.11, п. 7 + 23; раньше —
 * ComplexFaq, PLAN §10, п. 21): вопрос — раскрывающийся пункт без скриптов (details), под ним — FAQPage
 * для поиска. Вопросов нет — нет ничего.
 */
export async function FaqAccordion({ items }: { items: readonly FaqItem[] }) {
  const locale = (await getLocale()) as Locale;
  if (items.length === 0) return null;
  return (
    <>
      <ul className="faq-accordion">
        {items.map((item, index) => (
          <li key={index} className="faq-accordion__item">
            <details className="faq-accordion__details">
              <summary className="faq-accordion__question">
                {item.q[locale]}
                <ChevronDown className="faq-accordion__chevron" size={18} aria-hidden="true" />
              </summary>
              <p className="faq-accordion__answer">{item.a[locale]}</p>
            </details>
          </li>
        ))}
      </ul>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.q[locale],
            acceptedAnswer: { "@type": "Answer", text: item.a[locale] },
          })),
        }}
      />
    </>
  );
}
