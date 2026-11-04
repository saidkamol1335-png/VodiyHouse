import { House } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { Button } from "@/components/Button";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { Reveal } from "@/components/Reveal";
import type { Locale } from "@/lib/i18n/routing";
import { complexRoute } from "@/lib/routes";
import type { CardRoomType } from "@/lib/site/catalog/card";
import type { CatalogComplex } from "@/lib/site/catalog/records";
import type { ProgressSample } from "@/lib/site/home/stats";
import { DocsTile } from "./DocsTile";
import { RouteTile } from "./RouteTile";
import { VideoTile } from "./VideoTile";
import { Copy, Kicker } from "./WhyParts";
import { WhyCard } from "./WhyCard";

type HomeWhyProps = {
  /** «Остатки по каждому ЖК» — живой пример: первый ЖК ленты и его типы (мокап .avmini). */
  sample: { complex: CatalogComplex; types: CardRoomType[] } | null;
  /** «Видео стройки» (фаза 5): последний отчёт ЖК из ленты; нет отчётов — плитки нет. */
  video?: ProgressSample | null;
};

/**
 * «Почему через Vodiy House» — вариант А «Янтарь бренда» (артефакт «Сервис — бесплатно · анимации»,
 * 04.11.2026): бенто из 12 колонок — видео стройки во всю ширину, наличие (7) и янтарная «0%» (5),
 * проверка (4) и маршрут бесплатных услуг (8). У каждой карточки свой сюжет при появлении: full — как
 * в образце, lite — короткое проявление, none — сразу итог. Данные — настоящие: типы и остатки первого
 * ЖК ленты, кадр последнего отчёта, пункты проверки — ТЗ 8.4.
 */
export async function HomeWhy({ sample, video = null }: HomeWhyProps) {
  const t = await getTranslations("home.why");
  return (
    <section className="home-why" aria-labelledby="home-why-title">
      <Container>
        <Reveal variant="words">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <div id="home-why-title" className="home-why__title">
            <Heading level={2} accent={t("titleAccent")}>
              {t("title")}
            </Heading>
          </div>
        </Reveal>
        <div className="home-why__grid">
          {video ? (
            <WhyCard className="home-why__tile--video">
              <VideoTile video={video} />
            </WhyCard>
          ) : null}
          <StockTile sample={sample} />
          <FeeTile />
          <DocsTile />
          <RouteTile />
        </div>
      </Container>
    </section>
  );
}

/**
 * Счётчик «осталось N»: каждая цифра — лента 0–9 (цифры ленты рисует CSS, в тексте страницы — только
 * число), в full докручивается от нуля (одометр).
 */
function Odometer({ value }: { value: number }) {
  return (
    <>
      <span className="sr-only">{value}</span>
      <span className="home-why__odo" aria-hidden="true">
        {String(value)
          .split("")
          .map((digit, index) => (
            <span key={index} className="home-why__odo-win">
              <span className="home-why__odo-strip" style={{ "--odo": digit } as CSSProperties} />
            </span>
          ))}
      </span>
    </>
  );
}

async function StockTile({ sample }: Pick<HomeWhyProps, "sample">) {
  const t = await getTranslations("home.why");
  const locale = (await getLocale()) as Locale;
  return (
    <WhyCard className="home-why__tile--stock">
      <div className="home-why__split home-why__split--stock">
        <div className="home-why__copy">
          <Kicker index="02" text={t("stockKicker")} />
          <div className="home-why__body">
            <Copy title={t("stockTitle")} text={t("stockText")} />
            {sample ? (
              <Button
                variant="outline"
                size="sm"
                href={`/${locale}${complexRoute(sample.complex.slug)}`}
                className="home-why__cta home-why__rv home-why__rv--3"
              >
                <span className="home-why__cta-ico" aria-hidden="true">
                  <House size={16} />
                </span>
                {t("stockCta")}
              </Button>
            ) : null}
          </div>
        </div>
        {sample ? <StockPanel sample={sample} /> : null}
      </div>
    </WhyCard>
  );
}

/** Живой пример наличия: типы первого ЖК ленты и «осталось N». */
async function StockPanel({ sample }: { sample: NonNullable<HomeWhyProps["sample"]> }) {
  const [t, tRooms] = await Promise.all([
    getTranslations("home.why"),
    getTranslations("catalog.card"),
  ]);
  const locale = (await getLocale()) as Locale;
  const roomName = (rooms: number) =>
    rooms <= 4 ? tRooms(`rooms.${rooms as 0 | 1 | 2 | 3 | 4}`) : tRooms("rooms.more", { n: rooms });
  return (
    <div className="home-why__stock home-why__rv home-why__rv--2">
      <p className="home-why__stock-head">
        <span className="home-why__stock-name">
          {tRooms("name", { name: sample.complex.name[locale] })}
        </span>
        <span className="home-why__live">
          <i aria-hidden="true" />
          {t("stockLive")}
        </span>
      </p>
      <ul className="home-why__stock-list">
        {sample.types.map((type) => (
          <li key={type.rooms} className="home-why__stock-row">
            <span>{roomName(type.rooms)}</span>
            <b className="home-why__badge">
              {t.rich("stockLeft", { n: () => <Odometer value={type.free ?? 0} /> })}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** «0%»: цифры крутятся слот-машиной до нуля, «+ комиссия» зачёркивается, «= ваша цена» выскакивает. */
async function FeeTile() {
  const t = await getTranslations("home.why");
  return (
    <WhyCard className="home-why__tile--fee" delay={120}>
      <div className="home-why__fee">
        <Kicker index="03" text={t("priceKicker")} />
        {/* Заголовок — раньше равенства: диктор по заголовкам не пропускает его; на экране он внизу (order). */}
        <div className="home-why__body">
          <Copy title={t("priceTitle")} text={t("priceText")} />
        </div>
        <p className="home-why__eq home-why__rv home-why__rv--1">
          <span className="sr-only">{t("priceEqSr")}</span>
          <span className="home-why__eq-vis" aria-hidden="true">
            <span className="home-why__chip">{t("priceEqFrom")}</span>
            <span className="home-why__plus">
              {t("priceEqFee")}
              <span className="home-why__strike" />
            </span>
            <span className="home-why__chip home-why__chip--res">{t("priceEqYours")}</span>
          </span>
        </p>
        <span className="home-why__big" aria-hidden="true">
          <span className="home-why__big-win">
            <span className="home-why__big-strip" />
          </span>
          <span className="home-why__big-pct">%</span>
        </span>
      </div>
    </WhyCard>
  );
}
