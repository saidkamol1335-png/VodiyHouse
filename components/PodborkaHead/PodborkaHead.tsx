import { getTranslations } from "next-intl/server";
import { LeadButton } from "@/components/LeadDialog";

type PodborkaHeadProps = { count: number; names: string; path: string };

/**
 * Шапка подборки для получателя (Ф7 A): «Подборка: N ЖК», зачем она и «Подберём вручную» — заявка
 * «Подбор» с этими ЖК (менеджер видит список и ссылку). Связь — только с Vodiy House.
 */
export async function PodborkaHead({ count, names, path }: PodborkaHeadProps) {
  const t = await getTranslations("favorites.podborka");
  const context = t("context", { names });
  return (
    <div className="podborka-head">
      <h1 className="podborka-head__title">{t("title", { count })}</h1>
      <p className="podborka-head__lead">{count > 0 ? t("lead") : t("empty")}</p>
      <LeadButton intent={{ type: "pick", context, filters: { text: context, link: path } }} />
    </div>
  );
}
