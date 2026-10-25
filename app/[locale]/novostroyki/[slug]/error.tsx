"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";

// База не ответила (lib/site/complex/read.ts бросает исключение): посетитель видит «временно
// недоступна» с повтором, а в кэше остаётся прежняя страница — заглушку Next туда не кладёт.
export default function ComplexPageError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("siteError");
  return (
    <Container as="main">
      <div className="pt-36 pb-12">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("text")}</p>
        <Button className="mt-6" variant="outline" onClick={retry}>
          {t("retry")}
        </Button>
      </div>
    </Container>
  );
}
