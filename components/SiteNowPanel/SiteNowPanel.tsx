"use client";

import { Eye, Heart, Inbox, Phone, Send, Share2, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LeadWhen } from "@/components/LeadWhen";
import type { SiteNow, SiteNowItem, SiteNowResult } from "@/lib/admin/home/siteNow";
import { LEAD_TYPES, type LeadType } from "@/lib/leads/types";

const isLeadType = (value: string | null): value is LeadType => (LEAD_TYPES as readonly (string | null)[]).includes(value);

type SiteNowPanelProps = {
  /** Цифры страницы сервера; null — сервер не прочитал, панель прочитает сама. */
  initial: SiteNow | null;
  read: () => Promise<SiteNowResult>;
  siteHref: string;
};

const REFRESH_MS = 30_000;
const ICONS = {
  complex_view: Eye,
  phone_click: Phone,
  telegram_click: Send,
  favorite: Heart,
  share: Share2,
  filter: SlidersHorizontal,
  lead_sent: Inbox,
} as const satisfies Record<SiteNowItem["type"], unknown>;

/** Перечитывать раз в 30 секунд, пока вкладка видна; вернулись на вкладку — сразу. */
function useSiteNow(initial: SiteNow | null, read: SiteNowPanelProps["read"]) {
  const [now, setNow] = useState(initial);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible") return;
      const result = await read().catch((): SiteNowResult => ({ status: "error", error: "network" }));
      setFailed(result.status === "error");
      if (result.status === "done") setNow(result.now);
      timer = setTimeout(load, REFRESH_MS);
    };
    if (initial === null) void load();
    else timer = setTimeout(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [initial, read]);
  return { now, failed };
}

/** «Сейчас на сайте» (мокап CabHome): онлайн за 5 минут и последние действия посетителей. */
export function SiteNowPanel({ initial, read, siteHref }: SiteNowPanelProps) {
  const t = useTranslations("admin.home.now");
  const { now, failed } = useSiteNow(initial, read);
  return (
    <section className="site-now" aria-labelledby="site-now-title">
      <div className="site-now__head">
        <h2 id="site-now-title" className="site-now__title">
          {t("title")}
        </h2>
        {now ? (
          <span className="site-now__online">
            <i aria-hidden="true" />
            {t("online", { count: now.online })}
          </span>
        ) : null}
      </div>
      {failed && !now ? <p className="site-now__empty">{t("unavailable")}</p> : null}
      {now && now.feed.length === 0 ? <p className="site-now__empty">{t("empty")}</p> : null}
      <ul className="site-now__feed">
        {/* События одной пачки — одно время записи: ключ — ещё и место в ленте. */}
        {(now?.feed ?? []).map((item, index) => (
          <SiteNowRow key={`${item.at}-${item.type}-${index}`} item={item} />
        ))}
      </ul>
      <a className="site-now__site" href={siteHref} target="_blank" rel="noopener">
        {t("toSite")}
      </a>
    </section>
  );
}

function SiteNowRow({ item }: { item: SiteNowItem }) {
  const t = useTranslations("admin.home.now");
  const tLeads = useTranslations("admin.leads");
  const Icon = ICONS[item.type];
  // Заявка — подписью типа из «Заявок» («Просмотр», «Расчёт»).
  const detail = item.type === "lead_sent" && isLeadType(item.detail) ? tLeads(`types.${item.detail}`) : item.detail;
  return (
    <li className="site-now__row">
      <Icon size={16} aria-hidden="true" />
      <span className="site-now__text">
        <b>{itemText({ ...item, detail }, t)}</b>
        <span>{t("sub", { source: item.source ?? t("direct"), device: t(`devices.${item.device}`) })}</span>
      </span>
      <span className="site-now__time">
        <LeadWhen at={item.at} />
      </span>
    </li>
  );
}

type NowT = ReturnType<typeof useTranslations<"admin.home.now">>;

/** «Просмотр ЖК Shodlik», «Избранное · ЖК Bahor», «Поделились ссылкой · Telegram», «Фильтр: …». */
function itemText(item: SiteNowItem, t: NowT): string {
  const name = item.complex?.ru ?? null;
  if (item.type === "complex_view") return t("types.complex_view", { name: name ?? "—" });
  if (item.type === "filter") return t("types.filter", { detail: item.detail ?? "" });
  const text = t(`types.${item.type}`);
  if (name) return t("withComplex", { text, name });
  const detail = item.type === "share" && (item.detail === "telegram" || item.detail === "copy") ? t(`share.${item.detail}`) : item.detail;
  return detail ? t("withDetail", { text, detail }) : text;
}
