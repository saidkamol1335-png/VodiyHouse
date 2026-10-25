"use client";

import { useTranslations } from "next-intl";
import { formatDateTime, relativeStamp } from "@/lib/format";
import { useNow } from "@/lib/ui/useNow";

/**
 * «вчера в 03:14», «16.10 15:44» (мокап CabLeads, колонка «Когда»): часы общие на все строки. До
 * гидратации — полная дата по Ташкенту: время сервера и телефона расходится.
 */
export function LeadWhen({ at }: { at: string }) {
  const t = useTranslations("admin.leads");
  const now = useNow();
  const date = new Date(at);
  const stamp = now === null ? null : relativeStamp(date, new Date(now));
  if (stamp === null) return <time dateTime={at}>{formatDateTime(date)}</time>;
  return (
    <time dateTime={at}>
      {t("when", {
        kind: stamp.kind,
        minutes: stamp.kind === "minutes" ? stamp.minutes : 0,
        time: "time" in stamp ? stamp.time : "",
        date: stamp.kind === "date" ? stamp.date : "",
      })}
    </time>
  );
}
