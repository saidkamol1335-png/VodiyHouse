import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import type { ComplexPage } from "@/lib/site/complex/model";
import { documentImageKey } from "@/lib/site/complex/documentImages";
import { ComplexDocumentsList } from "./ComplexDocumentsList";

const dotted = (iso: string) => iso.split("-").reverse().join(".");

type ComplexDocumentsProps = {
  documents: ComplexPage["documents"];
  complexSlug: string;
  complexName: string;
};

/**
 * «Документы ЖК» (мокап .li, ТЗ 7.8): только проверенные — название, «?» с пояснением «что это значит
 * для вас», дата проверки. Сканы на сайт не загружаются — заявка менеджеру: «Запросить сканы
 * документов» у заголовка раздела или нажатие на строку (заявка 10.1). Вид — ComplexDocumentsList.
 */
export async function ComplexDocuments({ documents, complexSlug, complexName }: ComplexDocumentsProps) {
  const t = await getTranslations("complex.documents");
  const locale = (await getLocale()) as Locale;
  const rows = documents.map((document) => ({
    slug: document.slug,
    name: document.name[locale],
    hintLabel: t("hint", { name: document.name[locale] }),
    hint: document.hint ? document.hint[locale] : null,
    date: t("checkedOn", { date: dotted(document.checkedOn) }),
    image: documentImageKey(document.slug),
    requestLabel: t("requestScan", { name: document.name[locale] }),
  }));
  return <ComplexDocumentsList rows={rows} complexSlug={complexSlug} complexName={complexName} />;
}
