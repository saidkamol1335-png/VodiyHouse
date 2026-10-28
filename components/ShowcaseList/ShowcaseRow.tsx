"use client";

import { ChevronRight, Gift, LayoutGrid, Megaphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import { formatDate } from "@/lib/format";
import { adGoesFirst, byAdOrder, overlappingAds, showcaseStatus, type AdQueueItem } from "@/lib/admin/showcase/period";
import type { ShowcaseKind, ShowcaseStatus } from "@/lib/admin/showcase/types";
import type { ShowcaseListItem } from "./ShowcaseList";

const ICONS: Record<ShowcaseKind, LucideIcon> = { special: Gift, collection: LayoutGrid, ad: Megaphone };
const TONES: Record<ShowcaseStatus, BadgeTone> = { active: "ok", scheduled: "blue", expired: "neutral", off: "line" };

/** Дата ISO — день в Ташкенте (formatDate считает по APP_TIME_ZONE). */
const dayLabel = (iso: string) => formatDate(new Date(`${iso}T00:00:00+05:00`));

type Translate = ReturnType<typeof useTranslations<"admin.showcase.list">>;

type ShowcaseRowProps = {
  row: ShowcaseListItem;
  rows: readonly ShowcaseListItem[];
  href: string;
  today: string;
};

/** Строка вкладки: знак или обложка · название и подпись · статус периода · стрелка. */
export function ShowcaseRow({ row, rows, href, today }: ShowcaseRowProps) {
  const t = useTranslations("admin.showcase.list");
  const status = showcaseStatus(row, today);
  return (
    <li>
      <Link className="showcase-list__row" href={href} aria-label={t("open", { name: row.title })}>
        <ShowcaseMark row={row} />
        <span className="showcase-list__main">
          <span className="showcase-list__name">{row.title}</span>
          <span className="showcase-list__meta">{metaLine(row, t)}</span>
          <QueueNote row={row} rows={rows} />
        </span>
        <span className="showcase-list__status">
          <Badge tone={TONES[status]} dot>
            {statusLabel(status, row, t)}
          </Badge>
        </span>
        <ChevronRight className="showcase-list__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

function ShowcaseMark({ row }: { row: ShowcaseListItem }) {
  const Icon = ICONS[row.kind];
  if (row.coverSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- значок 48 px из бакета; next/image и CDN — на сайте
      <img className="showcase-list__cover" src={row.coverSrc} alt="" width={48} height={48} loading="lazy" />
    );
  }
  return (
    <span className="showcase-list__mark" aria-hidden="true">
      <Icon size={20} strokeWidth={1.7} />
    </span>
  );
}

/** «Застройщик · 2 ЖК · 01.11.2026 – 30.11.2026»; у подборки по фильтру — «по фильтру». */
function metaLine(row: ShowcaseListItem, t: Translate): string {
  const parts: string[] = [];
  if (row.developerName) parts.push(row.developerName);
  parts.push(row.byFilter ? t("byFilter") : t("complexes", { count: row.complexCount }));
  if (row.validFrom && row.validTo) {
    parts.push(t("period", { from: dayLabel(row.validFrom), to: dayLabel(row.validTo) }));
  }
  return parts.join(" · ");
}

function statusLabel(status: ShowcaseStatus, row: ShowcaseListItem, t: Translate): string {
  if (status === "scheduled") return t("status.scheduled", { date: dayLabel(row.validFrom ?? "") });
  if (status === "expired") return t("status.expired");
  return status === "off" ? t("status.off") : t("status.active");
}

type QueueRow = AdQueueItem & { title: string };

const asQueueRow = (row: ShowcaseListItem): QueueRow | null =>
  row.validFrom && row.validTo
    ? { id: row.id, title: row.title, isActive: row.isActive, validFrom: row.validFrom, validTo: row.validTo, sort: row.sort, createdAt: row.createdAt }
    : null;

/** Реклама (Г1 A): одно место на главной — кто покажется первым при пересечении периодов. */
function QueueNote({ row, rows }: { row: ShowcaseListItem; rows: readonly ShowcaseListItem[] }) {
  const t = useTranslations("admin.showcase.list");
  const me = row.kind === "ad" && row.isActive ? asQueueRow(row) : null;
  if (!me) return null;
  const queue = rows.map(asQueueRow).filter((item): item is QueueRow => item !== null);
  const overlapping = overlappingAds(me, queue);
  if (overlapping.length === 0) return null;
  const ahead = overlapping.find((other) => byAdOrder(other, me) < 0);
  const text =
    adGoesFirst(me, queue) || !ahead
      ? t("queueFirst", { title: overlapping[0]!.title })
      : t("queueWaits", { title: ahead.title });
  return <span className="showcase-list__note">{text}</span>;
}
