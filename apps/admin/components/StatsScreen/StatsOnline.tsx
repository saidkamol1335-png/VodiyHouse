"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SITE_NOW_EVENT } from "@/components/SiteNowPanel";
import { formatStatsCount } from "@/lib/stats/numbers";

/**
 * «Онлайн сейчас: N» в строке периодов (мокап CabStats): число с сервера, дальше — то же, что
 * перечитала панель «Сейчас на сайте» ниже (её событие), чтобы на экране не было двух разных онлайнов.
 */
export function StatsOnline({ initial }: { initial: number }) {
  const t = useTranslations("admin.stats");
  const [online, setOnline] = useState(initial);
  useEffect(() => {
    const update = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === "number") setOnline(event.detail);
    };
    window.addEventListener(SITE_NOW_EVENT, update);
    return () => window.removeEventListener(SITE_NOW_EVENT, update);
  }, []);
  return (
    <span className="stats-screen__online">
      <i aria-hidden="true" />
      {t("online", { count: formatStatsCount(online) })}
    </span>
  );
}
