import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";

// Заглушка главной фазы 0: обложка и разделы — фаза 3. Шапка — по решениям Ш1–Ш6.
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <>
      <SiteHeader transparentAtTop />
      <Container as="main">
        <div className="flex flex-col gap-6 pt-40 pb-24">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <Heading level={1} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
          <p className="text-muted-foreground">{t("skeleton")}</p>
        </div>
      </Container>
    </>
  );
}
