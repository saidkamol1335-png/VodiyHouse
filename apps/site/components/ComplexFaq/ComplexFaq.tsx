import { ChevronDown } from "lucide-react";
import { getLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/lib/i18n/routing";
import type { ComplexPage } from "@/lib/site/complex/model";

/**
 * «Частые вопросы» ЖК (PLAN §10, п. 21): вопрос — раскрывающийся пункт без скриптов (details), под
 * разделом — FAQPage для поиска. Ответы ведёт кабинет («О ЖК»); без вопросов раздела нет.
 */
export async function ComplexFaq({ faq }: { faq: ComplexPage["faq"] }) {
  const locale = (await getLocale()) as Locale;
  return (
    <>
      <ul className="complex-faq">
        {faq.map((item, index) => (
          <li key={index} className="complex-faq__item">
            <details className="complex-faq__details">
              <summary className="complex-faq__question">
                {item.q[locale]}
                <ChevronDown className="complex-faq__chevron" size={18} aria-hidden="true" />
              </summary>
              <p className="complex-faq__answer">{item.a[locale]}</p>
            </details>
          </li>
        ))}
      </ul>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((item) => ({
            "@type": "Question",
            name: item.q[locale],
            acceptedAnswer: { "@type": "Answer", text: item.a[locale] },
          })),
        }}
      />
    </>
  );
}
