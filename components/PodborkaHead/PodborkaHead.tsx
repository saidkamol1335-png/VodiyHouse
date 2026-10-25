import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { LeadButton } from "@/components/LeadDialog";
import { ROUTES } from "@/lib/routes";

type PodborkaHeadProps = { count: number; names: string; path: string };

/**
 * Шапка подборки для получателя (Ф7 A): «Подборка: N ЖК», зачем она и «Подберём вручную» — заявка
 * «Подбор» с этими ЖК (менеджер видит список и ссылку). Связь — только с Vodiy House.
 */
export async function PodborkaHead({ count, names, path }: PodborkaHeadProps) {
  const [t, locale] = await Promise.all([getTranslations("favorites.podborka"), getLocale()]);
  const context = t("context", { names });
  // Пустая или битая подборка: заявка «Подбор» без списка — менеджеру нечего читать в «Подборка: ».
  const intent = count > 0 ? { type: "pick" as const, context, filters: { text: context, link: path } } : { type: "pick" as const };
  return (
    <div className="podborka-head">
      <h1 className="podborka-head__title">{t("title", { count })}</h1>
      <p className="podborka-head__lead">{count > 0 ? t("lead") : t("empty")}</p>
      <div className="podborka-head__actions">
        <LeadButton intent={intent} />
        {count === 0 ? (
          <Button variant="outline" href={`/${locale}${ROUTES.catalog}`}>
            {t("toCatalog")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
