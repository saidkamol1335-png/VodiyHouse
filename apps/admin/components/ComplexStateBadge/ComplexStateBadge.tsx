import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import type { ComplexSiteState } from "@/lib/admin/complexes/completeness";
import type { PublicationStatus } from "@/lib/admin/publication";

type ComplexStateBadgeProps = {
  status: PublicationStatus;
  /** Состояние по правилу публикации; нет — данные не прочитаны (служебный стенд). */
  siteState?: { state: ComplexSiteState; done: number; total: number } | null;
  /** Опубликован, а застройщик — нет: сайт ЖК не покажет. */
  developerPublished?: boolean;
  size?: "md" | "sm";
};

type BadgeLook = { key: "draft" | "soon" | "onSite" | "hidden" | "archived"; tone: BadgeTone };

/** Значок строки (экран 2, PLAN §10 п. 23) — из статуса и состояния на сайте. */
export function complexBadgeLook(
  status: PublicationStatus,
  state: ComplexSiteState | null,
  developerPublished: boolean,
): BadgeLook {
  if (status === "draft") return { key: "draft", tone: "line" };
  if (status === "hidden" || (status === "published" && !developerPublished))
    return { key: "hidden", tone: "neutral" };
  if (status === "archived") return { key: "archived", tone: "amber" };
  return state === "soon" ? { key: "soon", tone: "amber" } : { key: "onSite", tone: "ok" };
}

/** «Черновик 4 из 6» · «Скоро» · «На сайте» · «Скрыт» · «Архив». */
export function ComplexStateBadge({
  status,
  siteState = null,
  developerPublished = true,
  size = "sm",
}: ComplexStateBadgeProps) {
  const t = useTranslations("admin.complexes.siteState");
  const look = complexBadgeLook(status, siteState?.state ?? null, developerPublished);
  const label =
    look.key === "draft" && siteState
      ? t("draft", { done: siteState.done, total: siteState.total })
      : t(look.key === "draft" ? "draftPlain" : look.key);
  return (
    <Badge tone={look.tone} size={size} dot>
      {label}
    </Badge>
  );
}

/** «Ожидает руководителя» — у ЖК с открытым запросом менеджера (п. 25). */
export function PendingRequestBadge({ size = "sm" }: { size?: "md" | "sm" }) {
  const t = useTranslations("admin.complexes.siteState");
  return (
    <Badge tone="blue" size={size}>
      {t("pending")}
    </Badge>
  );
}
