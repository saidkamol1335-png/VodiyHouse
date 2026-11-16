import { Building2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { mapLink, staticMapSrc, type GeoPoint, type MapLocale } from "@/lib/site/complex/location";

type LocationMapProps = {
  point: GeoPoint;
  name: string;
  address: string | null;
  locale: MapLocale;
};

/**
 * Карта ЖК (Ф5; правки 15.11, п. 17): статичная картинка Яндекса видна сразу, без кнопки «Показать на
 * карте», грузится лениво — тяжёлый JS карт не нужен (Lighthouse ≥ 90). Метка с названием — поверх;
 * «Открыть в Яндекс Картах» ведёт в интерактивную карту.
 */
export function LocationMap({ point, name, address, locale }: LocationMapProps) {
  const t = useTranslations("complex.location");
  const image = staticMapSrc(point, locale, process.env.NEXT_PUBLIC_YANDEX_MAPS_KEY);
  return (
    <div className="complex-location__map">
      <div className="complex-location__preview" role="img" aria-label={t("mapTitle", { name })}>
        {/* eslint-disable-next-line @next/next/no-img-element -- картинка Static API Яндекса, не из бакета */}
        <img className="complex-location__image" src={image} alt="" loading="lazy" decoding="async" />
        <span className="complex-location__pin" aria-hidden="true">
          <span className="complex-location__drop">
            <Building2 size={18} strokeWidth={1.9} />
          </span>
          <span className="complex-location__pin-label">
            <b>{name}</b>
            {address ? <small>{address}</small> : null}
          </span>
        </span>
      </div>
      <a className="complex-location__open" href={mapLink(point)} target="_blank" rel="noopener">
        <MapPin size={16} strokeWidth={2} aria-hidden />
        {t("openMap")}
      </a>
    </div>
  );
}
