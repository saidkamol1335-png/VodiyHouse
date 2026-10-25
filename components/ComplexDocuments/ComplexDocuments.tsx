import { Check } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { TermHint } from "@/components/TermHint";
import type { Locale } from "@/lib/i18n/routing";
import type { ComplexPage } from "@/lib/site/complex/model";

const dotted = (iso: string) => iso.split("-").reverse().join(".");

/**
 * «Документы ЖК» (мокап .li, ТЗ 7.8): только проверенные — ✓, название, «?» с пояснением «что это
 * значит для вас», дата проверки. Сканы на сайт не загружаются — «Запросить сканы документов» у
 * заголовка раздела (заявка 10.1).
 */
export async function ComplexDocuments({ documents }: { documents: ComplexPage["documents"] }) {
  const t = await getTranslations("complex.documents");
  const locale = (await getLocale()) as Locale;
  return (
    <ul className="complex-documents">
      {documents.map((document) => (
        <li key={document.slug} className="complex-documents__item">
          <span className="complex-documents__check" aria-hidden="true">
            <Check size={13} strokeWidth={2.6} />
          </span>
          <span className="complex-documents__name">
            <b>{document.name[locale]}</b>
            {document.hint ? <TermHint label={t("hint", { name: document.name[locale] })} text={document.hint[locale]} /> : null}
          </span>
          <span className="complex-documents__date">{t("checkedOn", { date: dotted(document.checkedOn) })}</span>
        </li>
      ))}
    </ul>
  );
}
