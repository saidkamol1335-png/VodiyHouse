import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import type { PublicationStatus } from "@/lib/admin/publication";

// Опубликованное — зелёным, архив — янтарём (через 30 дней удалится), черновик — пунктиром.
const TONES: Record<PublicationStatus, BadgeTone> = {
  draft: "line",
  published: "ok",
  hidden: "neutral",
  archived: "amber",
};

/** Плашка статуса ЖК или застройщика в списках и на странице кабинета (решение Д1). */
export function PublicationBadge({ status }: { status: PublicationStatus }) {
  const t = useTranslations("admin.publication");
  return (
    <Badge tone={TONES[status]} dot>
      {t(status)}
    </Badge>
  );
}
