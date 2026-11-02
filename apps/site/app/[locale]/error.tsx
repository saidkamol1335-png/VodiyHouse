"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { SiteBareHeader } from "@/components/SiteBareHeader";
import { ROUTES } from "@/lib/routes";

// База не ответила (каталог — lib/site/catalog/read.ts, страница ЖК — lib/site/complex/read.ts
// бросают исключение): посетитель видит «временно недоступна» с повтором, а в кэше остаётся
// прежняя страница — заглушку Next туда не кладёт. Шапка — облегчённая (SiteBareHeader): полная
// шапка в границе ошибки дублировала бы свой код на каждой странице сайта.
export default function SitePageError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("siteError");
  const locale = useLocale();
  return (
    <>
      <SiteBareHeader />
      <Container as="main">
        <div className="pt-16 pb-12">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("text")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="outline" onClick={retry}>
              {t("retry")}
            </Button>
            <Button variant="ghost" href={`/${locale}${ROUTES.catalog}`}>
              {t("toCatalog")}
            </Button>
          </div>
        </div>
      </Container>
    </>
  );
}
