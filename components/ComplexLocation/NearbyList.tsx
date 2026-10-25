"use client";

import { Car } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/routing";
import { distanceOf } from "@/lib/site/complex/location";
import type { NearbyPlace } from "@/lib/site/complex/nearby";
import { KIND_ICONS } from "./kindIcons";

type NearbyListProps = {
  places: readonly NearbyPlace[];
  minutesToCenter: number | null;
  city: string | null;
};

/** «Удобство локации» (мокап .jloc__side): вид места, название, метры и минуты; последним — центр. */
export function NearbyList({ places, minutesToCenter, city }: NearbyListProps) {
  const t = useTranslations("complex.location");
  return (
    <aside className="complex-location__side" aria-labelledby="complex-convenience">
      <p id="complex-convenience" className="complex-location__side-title">
        {t("convenience")}
      </p>
      <ul className="complex-location__list">
        {places.map((place) => (
          <NearbyItem key={`${place.kind}-${place.name.ru}`} place={place} />
        ))}
        {minutesToCenter ? (
          <li className="complex-location__item">
            <span className="complex-location__icon complex-location__icon--car" aria-hidden="true">
              <Car size={16} strokeWidth={2} />
            </span>
            <span className="complex-location__label">
              <b>{t("center")}</b>
              {city ? <small>{city}</small> : null}
            </span>
            <span className="complex-location__value">
              <b>{t("minutes", { n: minutesToCenter })}</b>
              <small>{t("byCar")}</small>
            </span>
          </li>
        ) : null}
      </ul>
      {places.length > 0 ? <p className="complex-location__note">{t("note")}</p> : null}
    </aside>
  );
}

/** «Школа · Школа №46 — 270 м, 4 мин пешком»: без метров — крупно минуты. */
function NearbyItem({ place }: { place: NearbyPlace }) {
  const t = useTranslations("complex.location");
  const locale = useLocale() as Locale;
  const Icon = KIND_ICONS[place.kind];
  const distance = place.meters ? distanceOf(place.meters) : null;
  const time = place.minutes ? t(place.mode === "car" ? "car" : "walk", { n: place.minutes }) : null;
  return (
    <li className="complex-location__item">
      <span className={`complex-location__icon complex-location__icon--${place.kind}`} aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className="complex-location__label">
        <b>{t(`kinds.${place.kind}`)}</b>
        <small>{place.name[locale]}</small>
      </span>
      <span className="complex-location__value">
        <b>{distance ? t(distance.unit === "m" ? "meters" : "km", { n: distance.value }) : time}</b>
        {distance && time ? <small>{time}</small> : null}
      </span>
    </li>
  );
}
