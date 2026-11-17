"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatPriceShort, formatUsdThousands } from "@vh/shared/format";
import type { Locale } from "@/lib/i18n/routing";
import type { PickerUnit } from "@/lib/site/picker/records";

/**
 * Подписи квартиры для плитки плана и сетки этажа: комнаты («2К»), цена свободной («$42K»), метка
 * статуса и подпись для диктора — одни и те же в обоих видах.
 */
export function useUnitTexts(unit: PickerUnit) {
  const t = useTranslations("complex.pick");
  const tRooms = useTranslations("complex.rooms");
  const tLegend = useTranslations("complex.pick.legend");
  const locale = useLocale() as Locale;
  const rooms = unit.rooms === null ? "" : unit.rooms <= 4 ? tRooms(String(unit.rooms) as "0") : tRooms("more", { n: unit.rooms });
  const price = unit.price === null ? null : unit.currency === "USD" ? formatUsdThousands(unit.price) : formatPriceShort(unit.price, unit.currency, locale);
  return {
    roomsShort: unit.rooms !== null ? t("roomsShort", { rooms: unit.rooms }) : null,
    price,
    tag: unit.status === "pending" ? t("pendingTag") : tLegend(unit.status),
    aria: [t("unitAria", { number: unit.number }), rooms, unit.status === "free" ? price : null, tLegend(unit.status)].filter(Boolean).join(", "),
  };
}
