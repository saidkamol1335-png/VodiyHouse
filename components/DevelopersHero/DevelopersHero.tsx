import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";

type DevelopersHeroProps = {
  /** Застройщиков на сайте; null — база не ответила, счётчика нет. */
  count: number | null;
};

/** Шапка списка застройщиков (мокап SiteDevs): надзаголовок, заголовок с акцентом, подводка о правиле 1.2. */
export async function DevelopersHero({ count }: DevelopersHeroProps) {
  const t = await getTranslations("developers");
  return (
    <section className="developers-hero">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <h1 className="heading heading--h1 developers-hero__title">
          {t.rich("title", { accent: (chunks) => <span className="heading__accent">{chunks}</span> })}
        </h1>
        <p className="developers-hero__lead">{t("lead")}</p>
        {count !== null ? <p className="developers-hero__count">{t("count", { n: count })}</p> : null}
      </Container>
    </section>
  );
}
