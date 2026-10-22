"use client";

import { useTranslations } from "next-intl";
import { relativeStamp } from "@/lib/format";
import { useNow } from "@/lib/ui/useNow";

/** «5 мин назад · Дилноза Юсупова»: часы общие на все строки, тикают раз в 30 с. */
export function UpdatedAgo({ at, by }: { at: string; by: string | null }) {
  const t = useTranslations("admin.complexes.units.list");
  const now = useNow();
  if (now === null) return null;
  const stamp = relativeStamp(new Date(at), new Date(now));
  if (stamp === null) return null;
  const when = t("updated", {
    kind: stamp.kind,
    minutes: stamp.kind === "minutes" ? stamp.minutes : 0,
    time: "time" in stamp ? stamp.time : "",
    date: stamp.kind === "date" ? stamp.date : "",
  });
  return <>{by ? t("updatedBy", { when, name: by }) : when}</>;
}
