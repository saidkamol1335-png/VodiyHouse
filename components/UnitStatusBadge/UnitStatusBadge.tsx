import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import type { UnitStatus } from "@/lib/units";

/** Цвета статусов — как в мокапе: свободна — зелёный, бронь — янтарь, продана — розовый. */
export const UNIT_STATUS_TONES: Record<UnitStatus, BadgeTone> = {
  free: "ok",
  reserved: "amber",
  sold: "bad",
};

type UnitStatusBadgeProps = {
  status: UnitStatus;
  size?: "md" | "sm";
};

/** Плашка статуса квартиры — одна на журнал и список квартир. */
export function UnitStatusBadge({ status, size = "sm" }: UnitStatusBadgeProps) {
  const t = useTranslations("admin.journal.unitStatus");
  return (
    <Badge tone={UNIT_STATUS_TONES[status]} size={size} dot={size === "md"}>
      {t(status)}
    </Badge>
  );
}
