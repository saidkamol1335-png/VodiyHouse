import { MapPin, Navigation } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/routing";
import { distanceOf, nearestSchool, routeLink, searchLink, SEARCH_KINDS, type GeoPoint } from "@/lib/site/complex/location";
import type { NearbyPlace } from "@/lib/site/complex/nearby";
import { NearbyList } from "./NearbyList";
import { LocationMap } from "./LocationMap";
import { KIND_ICONS } from "./kindIcons";

type ComplexLocationProps = {
  /** «ЖК Shodlik» на языке страницы. */
  name: string;
  address: string | null;
  point: GeoPoint | null;
  nearby: readonly NearbyPlace[];
  minutesToCenter: number | null;
  city: string | null;
  landmark: string | null;
};

/**
 * Карточка «Расположение» (мокап .omap.jloc, Ф5): вопрос «удобно ли добираться» и «Проложить
 * маршрут», карта по нажатию и «Удобство локации», поиск мест рядом, ориентир. Без точки — без
 * карты и ссылок, без списка — карта на всю ширину.
 */
export function ComplexLocation({ name, address, point, nearby, minutesToCenter, city, landmark }: ComplexLocationProps) {
  const t = useTranslations("complex.location");
  const locale = useLocale() as Locale;
  const hasList = nearby.length > 0 || Boolean(minutesToCenter);
  return (
    <div className="complex-location">
      {point ? (
        <div className="complex-location__bar">
          <span className="complex-location__bar-icon" aria-hidden="true">
            <MapPin size={20} strokeWidth={2} />
          </span>
          <p className="complex-location__question">{t("question", { name })}</p>
          <a className="complex-location__route" href={routeLink(point)} target="_blank" rel="noopener">
            <Navigation size={16} strokeWidth={1.9} aria-hidden />
            {t("route")}
          </a>
        </div>
      ) : null}
      {point || hasList ? (
        <div className={point && hasList ? "complex-location__grid" : "complex-location__grid complex-location__grid--single"}>
          {point ? <LocationMap point={point} name={name} address={address} locale={locale} /> : null}
          {hasList ? <NearbyList places={nearby} minutesToCenter={minutesToCenter} city={city} /> : null}
        </div>
      ) : null}
      {point ? (
        <nav className="complex-location__chips" aria-label={t("nearbyLabel")}>
          {SEARCH_KINDS.map((kind) => {
            const Icon = KIND_ICONS[kind];
            return (
              <a key={kind} className="complex-location__chip" href={searchLink(point, t(`search.${kind}`))} target="_blank" rel="noopener">
                <Icon size={17} strokeWidth={1.8} aria-hidden />
                {t(`chips.${kind}`)}
              </a>
            );
          })}
        </nav>
      ) : null}
      <LocationMark landmark={landmark} nearby={nearby} locale={locale} />
    </div>
  );
}

function LocationMark({ landmark, nearby, locale }: { landmark: string | null; nearby: readonly NearbyPlace[]; locale: Locale }) {
  const t = useTranslations("complex.location");
  if (!landmark) return null;
  const school = nearestSchool(nearby);
  const distance = school?.meters ? distanceOf(school.meters) : null;
  const schoolText = school && distance ? ` · ${school.name[locale]} — ${t(distance.unit === "m" ? "meters" : "km", { n: distance.value })}` : "";
  return (
    <p className="complex-location__mark">
      <MapPin size={16} strokeWidth={1.9} aria-hidden />
      <span>
        <b>{t("landmark")}</b> {landmark}
        {schoolText}
      </span>
    </p>
  );
}
