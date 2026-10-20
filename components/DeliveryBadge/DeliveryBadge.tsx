import { useTranslations } from "next-intl";
import { Badge } from "@/components/Badge";
import { deliveryStatus } from "@/lib/quarters";

type DeliveryBadgeProps = { plannedOn: string | null; deliveredOn: string | null };

/** «Сдан в срок» / «Перенос на N мес.» у сданного объекта (мокап, страница застройщика). */
export function DeliveryBadge({ plannedOn, deliveredOn }: DeliveryBadgeProps) {
  const t = useTranslations("admin.quarters");
  const status = deliveryStatus(plannedOn, deliveredOn);
  if (!status) return null;
  return status.kind === "onTime" ? (
    <Badge tone="ok">{t("onTime")}</Badge>
  ) : (
    <Badge tone="amber">{t("delayed", { months: status.months })}</Badge>
  );
}
