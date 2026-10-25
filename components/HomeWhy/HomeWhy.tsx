import { House } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Spotlight } from "@/components/Spotlight";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import type { CardRoomType } from "@/lib/site/catalog/card";
import type { CatalogComplex } from "@/lib/site/catalog/records";

type HomeWhyProps = {
  /** «Остатки по каждому ЖК» — живой пример: первый ЖК ленты и его типы (мокап .avmini). */
  sample: { complex: CatalogComplex; types: CardRoomType[] } | null;
};

/**
 * «Почему через Vodiy House» (мокап .bento): наличие на живом примере, цена как у застройщика
 * («0%»), проверенные документы, бесплатные услуги лентой. Плитка видео стройки — с фазой 5
 * (решение фазы 3: «Смотреть пример» скрыт до видео). Подсветка за курсором — только full.
 */
export async function HomeWhy({ sample }: HomeWhyProps) {
  const t = await getTranslations("home.why");
  return (
    <section className="home-why" aria-labelledby="home-why-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="home-why-title" className="home-why__title">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <div className="home-why__grid">
          <StockTile sample={sample} />
          <Spotlight className="home-why__tile home-why__tile--olive">
            <span className="home-why__big" aria-hidden="true">{t("priceBig")}</span>
            <Tile kicker={t("priceKicker")} title={t("priceTitle")} text={t("priceText")} />
          </Spotlight>
          <Spotlight className="home-why__tile">
            <DocsDrawing />
            <Tile kicker={t("docsKicker")} title={t("docsTitle")} text={t("docsText")} />
          </Spotlight>
          <Spotlight className="home-why__tile home-why__tile--wide">
            <ServicePills pills={t("pills").split(" · ")} />
            <Tile kicker={t("freeKicker")} title={t("freeTitle")} text={t("freeText")} />
          </Spotlight>
        </div>
      </Container>
    </section>
  );
}

function Tile({ kicker, title, text, children }: { kicker: string; title: string; text: string; children?: ReactNode }) {
  return (
    <>
      <p className="home-why__kicker">{kicker}</p>
      <div className="home-why__body">
        <p className="home-why__tile-title">{title}</p>
        <p className="home-why__text">{text}</p>
        {children}
      </div>
    </>
  );
}

async function StockTile({ sample }: HomeWhyProps) {
  const [t, tRooms] = await Promise.all([getTranslations("home.why"), getTranslations("catalog.card")]);
  const locale = (await getLocale()) as Locale;
  return (
    <Spotlight className="home-why__tile home-why__tile--wide">
      {sample ? (
        <div className="home-why__stock" aria-hidden="true">
          <p className="home-why__stock-name">{tRooms("name", { name: sample.complex.name[locale] })}</p>
          {sample.types.map((type) => (
            <p key={type.rooms} className="home-why__stock-row">
              <span>{type.rooms <= 4 ? tRooms(`rooms.${type.rooms as 0 | 1 | 2 | 3 | 4}`) : tRooms("rooms.more", { n: type.rooms })}</span>
              <b className={(type.free ?? 0) <= 3 ? "home-why__stock-left home-why__stock-left--few" : "home-why__stock-left"}>
                {tRooms("left", { n: type.free ?? 0 })}
              </b>
            </p>
          ))}
        </div>
      ) : null}
      <Tile kicker={t("stockKicker")} title={t("stockTitle")} text={t("stockText")}>
        {sample ? (
          <Button variant="outline" size="sm" href={complexRoute(sample.complex.slug)} className="home-why__cta">
            <House size={16} aria-hidden="true" />
            {t("stockCta")}
          </Button>
        ) : null}
      </Tile>
    </Spotlight>
  );
}

/** Документ с галочкой (мокап .docs-draw): в full линии прорисовываются, иначе — сразу. */
function DocsDrawing() {
  return (
    <svg className="home-why__docs" viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
      <path d="M30 14h44l18 18v74H30z" />
      <path d="M74 14v18h18" />
      <path d="M44 70l12 12 22-26" />
    </svg>
  );
}

/** Услуги лентой (мокап .pills): в full ползут вверх, иначе стоят. */
function ServicePills({ pills }: { pills: string[] }) {
  return (
    <div className="home-why__pills" aria-hidden="true">
      <div className="home-why__pills-track">
        {[...pills, ...pills].map((pill, index) => (
          <span key={index} className="home-why__pill" style={{ ["--pill-shift" as string]: `${Math.round(Math.sin(index * 1.3) * 22)}px` }}>
            {pill}
          </span>
        ))}
      </div>
    </div>
  );
}
