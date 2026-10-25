import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/Button";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SitePhoto } from "@/components/SitePhoto";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import type { CatalogPhoto } from "@/lib/site/catalog/records";
import type { HeroFound, HomeStats } from "@/lib/site/home/stats";

type HomeHeroProps = {
  stats: HomeStats;
  found: HeroFound;
  /** Обложки ЖК каталога: первая — фон первого экрана (LCP), до пяти — в видоискателе. */
  photos: readonly { photo: CatalogPhoto; name: string }[];
  /** Якорь ленты каталога ниже на странице. */
  catalogId: string;
};

/**
 * Первый экран главной (мокап .hero, без заставки — «Вижу проблему»): надзаголовок, заголовок с
 * курсивом, обещание, «Подобрать квартиру», три «бесплатно», цифры из каталога и видоискатель с
 * фото ЖК и примером запроса. Заголовок не анимируется — это LCP; живут фон и видоискатель (§3).
 */
export async function HomeHero({ stats, found, photos, catalogId }: HomeHeroProps) {
  const t = await getTranslations("home");
  const cover = photos[0];
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      {cover ? (
        <div className="home-hero__bg" aria-hidden="true">
          <SitePhoto photo={cover.photo} alt="" frame="cover" sizes="100vw" preload className="home-hero__bg-photo" />
        </div>
      ) : null}
      <div className="home-hero__inner">
        <div className="home-hero__text">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <div id="home-hero-title" className="home-hero__title">
            <Heading level={1} accent={t("titleAccent")}>
              {t("title")}
            </Heading>
          </div>
          <p className="home-hero__lead">{t("lead")}</p>
          <div className="home-hero__actions">
            <Button href={`#${catalogId}`} className="home-hero__cta">
              {t("cta")}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
          <ul className="home-hero__free">
            {(["price", "service", "docs"] as const).map((key) => (
              <li key={key}>
                <Check size={16} aria-hidden="true" />
                {t(`free.${key}`)}
              </li>
            ))}
          </ul>
          <HeroStats stats={stats} />
        </div>
        <HeroViewfinder found={found} photos={viewfinderSlots(photos)} />
      </div>
      <a href={`#${catalogId}`} className="home-hero__scroll">
        <ChevronDown size={16} aria-hidden="true" />
        {t("scroll")}
      </a>
    </section>
  );
}

/** Пять мест видоискателя (анимация full рассчитана на пять): ЖК меньше — фото повторяются. */
const VF_SLOTS = 5;
function viewfinderSlots<T>(photos: readonly T[]): T[] {
  if (photos.length === 0) return [];
  return Array.from({ length: VF_SLOTS }, (_, index) => photos[index % photos.length]!);
}

async function HeroStats({ stats }: { stats: HomeStats }) {
  const t = await getTranslations("home.stats");
  const locale = (await getLocale()) as Locale;
  const number = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU");
  const items = [
    { key: "complexes", value: stats.complexes },
    { key: "developers", value: stats.developers },
    { key: "flats", value: stats.flats },
  ] as const;
  return (
    <dl className="home-hero__stats" aria-label={t("label")}>
      {items.map((item) => (
        <div key={item.key} className="home-hero__stat">
          <dt>{t(item.key, { count: item.value })}</dt>
          <dd>{item.key === "flats" && stats.partial ? `${number.format(item.value)}+` : number.format(item.value)}</dd>
        </div>
      ))}
    </dl>
  );
}

type ViewfinderProps = { found: HeroFound; photos: readonly { photo: CatalogPhoto; name: string }[] };

/**
 * Видоискатель (мокап .vf): фото ЖК по очереди, рамка с метками, «Найдено сейчас» и строка запроса
 * — ссылка на каталог с этим фильтром (Ф3: ссылки с фильтром ведут на /novostroyki?…).
 */
async function HeroViewfinder({ found, photos }: ViewfinderProps) {
  const t = await getTranslations("home.vf");
  if (photos.length === 0) return null;
  return (
    <div className="home-hero__vf">
      <p className="home-hero__vf-label">
        <span className="home-hero__vf-rec">
          <i aria-hidden="true" />
          {t("label")}
        </span>
        <span aria-hidden="true">{t("coords")}</span>
      </p>
      <div className="home-hero__vf-media" aria-hidden="true">
        {photos.map((item, index) => (
          <div key={index} className="home-hero__vf-photo" style={{ ["--vf-index" as string]: index }}>
            <SitePhoto photo={item.photo} alt="" frame="phone" sizes="(max-width: 760px) 300px, 420px" />
          </div>
        ))}
      </div>
      <span className="home-hero__vf-frame" aria-hidden="true" />
      <span className="home-hero__vf-orbit" aria-hidden="true" />
      <p className="home-hero__vf-found">
        <small>{t("found")}</small>
        {t("foundValue", { complexes: found.complexes, flats: found.flats })}
      </p>
      <Link href={`${ROUTES.catalog}${found.search}`} className="home-hero__vf-chat">
        <span className="home-hero__vf-query">{t("query")}</span>
        <span className="home-hero__vf-go" aria-hidden="true">
          {t("go")}
        </span>
      </Link>
    </div>
  );
}
