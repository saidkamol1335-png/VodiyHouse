"use client";

import { Hand } from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatPriceShort, formatUsdThousands } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import { boxOf, placeUnits, polygonPoints, type PlacedUnit } from "@/lib/site/picker/model";
import type { FloorPlan, PickerUnit } from "@/lib/site/picker/records";

type PickerFloorPlanProps = {
  plan: FloorPlan;
  floor: number;
  blockName: string;
  units: PickerUnit[];
  selected: string | null;
  onUnit: (unitId: string) => void;
};

const STATUS_CLASS = { free: "free", reserved: "reserved", sold: "sold" } as const;

/**
 * План этажа (мокап .fplan / .fpw): картинка плана, поверх — контуры квартир цветом статуса и плитка
 * с номером, комнатами и ценой свободной. Свободная — открывает квартиру; бронь и продана — строка
 * «Квартира № 44 уже продана · Зелёные квартиры на этом этаже свободны».
 */
export function PickerFloorPlan({ plan, floor, blockName, units, selected, onUnit }: PickerFloorPlanProps) {
  const t = useTranslations("complex.pick");
  const [note, setNote] = useState<string | null>(null);
  const placed = placeUnits(plan, floor, units).filter((item): item is PlacedUnit & { unit: PickerUnit } => item.unit !== null);
  const free = placed.filter((item) => item.unit.status === "free").length;
  const pick = ({ unit }: { unit: PickerUnit }) => {
    if (unit.status === "free") {
      setNote(null);
      return onUnit(unit.id);
    }
    setNote(`${t(unit.status === "reserved" ? "reservedNote" : "soldNote", { number: unit.number })}. ${t("seeGreen")}`);
  };
  const title = [t("planTitle", { floor, block: blockName }), plan.entrance !== null ? t("planEntrance", { n: plan.entrance }) : null].filter(Boolean).join(" · ");
  return (
    <div className="complex-picker__sheet">
      <p className="complex-picker__sheet-head">
        <span>{title}</span>
        <span>{t("planFree", { free, total: placed.length })}</span>
      </p>
      <PlanSheet plan={plan} placed={placed} selected={selected} onPick={pick} />
      <p className="complex-picker__note" role="status">
        {note}
      </p>
      <p className="complex-picker__tap">
        <Hand size={16} aria-hidden="true" />
        {t("tapHint")}
      </p>
    </div>
  );
}

type Placed = PlacedUnit & { unit: PickerUnit };

function PlanSheet({ plan, placed, selected, onPick }: { plan: FloorPlan; placed: Placed[]; selected: string | null; onPick: (item: Placed) => void }) {
  return (
    <div className="complex-picker__floor-plan" style={{ aspectRatio: `${plan.image.width} / ${plan.image.height}` }}>
      <Image
        src={mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", plan.image.path)}
        alt=""
        fill
        sizes="(max-width: 760px) 100vw, 1000px"
        className="complex-picker__plan-image"
      />
      <svg className="complex-picker__units" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {placed.map(({ contour, unit }) => (
          <polygon
            key={unit.id}
            points={polygonPoints(contour.points)}
            className={`complex-picker__unit-shape complex-picker__unit-shape--${STATUS_CLASS[unit.status]}${unit.id === selected ? " complex-picker__unit-shape--selected" : ""}`}
          />
        ))}
      </svg>
      {placed.map((item) => (
        <UnitTile key={item.unit.id} item={item} selected={item.unit.id === selected} onPick={() => onPick(item)} />
      ))}
    </div>
  );
}

function UnitTile({ item, selected, onPick }: { item: Placed; selected: boolean; onPick: () => void }) {
  const t = useTranslations("complex.pick");
  const tRooms = useTranslations("complex.rooms");
  const tLegend = useTranslations("complex.pick.legend");
  const locale = useLocale() as Locale;
  const { unit } = item;
  const box = boxOf(item.contour.points);
  const rooms = unit.rooms === null ? "" : unit.rooms <= 4 ? tRooms(String(unit.rooms) as "0") : tRooms("more", { n: unit.rooms });
  const price = unit.price === null ? null : unit.currency === "USD" ? formatUsdThousands(unit.price) : formatPriceShort(unit.price, unit.currency, locale);
  return (
    <button
      type="button"
      className={`complex-picker__unit complex-picker__unit--${STATUS_CLASS[unit.status]}`}
      style={{ left: `${box.x0}%`, top: `${box.y0}%`, width: `${box.x1 - box.x0}%`, height: `${box.y1 - box.y0}%` }}
      aria-pressed={unit.status === "free" ? selected : undefined}
      data-unit-id={unit.id}
      aria-label={[t("unitAria", { number: unit.number }), rooms, unit.status === "free" ? price : null, tLegend(unit.status)].filter(Boolean).join(", ")}
      onClick={onPick}
    >
      <span className="complex-picker__unit-number">№{unit.number}</span>
      {unit.rooms !== null ? <span className="complex-picker__unit-rooms">{t("roomsShort", { rooms: unit.rooms })}</span> : null}
      {unit.status === "free" ? (price ? <span className="complex-picker__unit-price">{price}</span> : null) : <span className="complex-picker__unit-tag">{tLegend(unit.status)}</span>}
    </button>
  );
}
