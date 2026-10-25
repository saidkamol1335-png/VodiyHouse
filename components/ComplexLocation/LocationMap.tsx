"use client";

import { Building2, Map as MapIcon, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { mapLink, mapWidgetSrc, staticMapSrc, type GeoPoint, type MapLocale } from "@/lib/site/complex/location";

type LocationMapProps = {
  point: GeoPoint;
  name: string;
  address: string | null;
  locale: MapLocale;
};

/**
 * Карта ЖК (Ф5): до нажатия — картинка (Static API с ключом заказчика) или своя заглушка с меткой,
 * по нажатию — интерактивная карта Яндекса во фрейме. Тяжёлый JS карт не грузится с первым экраном
 * (Lighthouse ≥ 90); «Открыть в Яндекс Картах» работает всегда.
 */
export function LocationMap({ point, name, address, locale }: LocationMapProps) {
  const t = useTranslations("complex.location");
  const [live, setLive] = useState(false);
  const image = staticMapSrc(point, locale, process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY);
  return (
    <div className="complex-location__map">
      {live ? (
        <iframe className="complex-location__frame" src={mapWidgetSrc(point, locale)} title={t("mapTitle", { name })} allowFullScreen />
      ) : (
        <button type="button" className="complex-location__preview" onClick={() => setLive(true)} aria-label={t("showMap")}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- картинка Static API Яндекса, не из бакета
            <img className="complex-location__image" src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="complex-location__pattern" aria-hidden="true" />
          )}
          <span className="complex-location__pin" aria-hidden="true">
            <span className="complex-location__drop">
              <Building2 size={18} strokeWidth={1.9} />
            </span>
            <span className="complex-location__pin-label">
              <b>{name}</b>
              {address ? <small>{address}</small> : null}
            </span>
          </span>
          <span className="complex-location__show">
            <MapIcon size={16} strokeWidth={1.9} aria-hidden />
            {t("showMap")}
          </span>
        </button>
      )}
      <a className="complex-location__open" href={mapLink(point)} target="_blank" rel="noopener">
        <MapPin size={16} strokeWidth={2} aria-hidden />
        {t("openMap")}
      </a>
    </div>
  );
}
