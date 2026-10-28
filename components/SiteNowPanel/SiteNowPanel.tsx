"use client";

import { Eye, Heart, Inbox, Megaphone, Phone, Send, Share2, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LeadWhen } from "@/components/LeadWhen";
import { OTHER_SOURCE, type SiteNow, type SiteNowItem, type SiteNowResult } from "@/lib/admin/home/siteNow";
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
  // Реклама (3.16б): показы в ленту не идут (site_now их не отдаёт), клик — с заголовком рекламы.
  ad_view: Megaphone,
  ad_click: Megaphone,
} as const satisfies Record<SiteNowItem["type"], unknown>;

/** Перечитывать раз в 30 секунд, пока вкладка видна; вернулись на вкладку — сразу. */
function useSiteNow(initial: SiteNow | null, read: SiteNowPanelProps["read"]) {
  const [now, setNow] = useState(initial);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Ушли с главной или запрос ещё идёт — не начинать второй и не заводить таймер после ухода.
    let active = true;
    let loading = false;
    const load = async () => {
      clearTimeout(timer);
      if (document.visibilityState !== "visible" || loading) return;
      loading = true;
      const result = await read().catch((): SiteNowResult => ({ status: "error", error: "network" }));
      loading = false;
      if (!active) return;
      setFailed(result.status === "error");
      if (result.status === "done") setNow(result.now);
      timer = setTimeout(load, REFRESH_MS);
    };
    if (initial === null) void load();
    else timer = setTimeout(load, REFRESH_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
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
  // Заявка — подписью типа из «Заявок» («Просмотр», «Расчёт»); незнакомое слово не показываем.
  const leadType = item.type === "lead_sent" && isLeadType(item.detail) ? tLeads(`types.${item.detail}`) : null;
  const detail = item.type === "lead_sent" ? leadType : item.detail;
  return (
    <li className="site-now__row">
      <Icon size={16} aria-hidden="true" />
      <span className="site-now__text">
        <b>{itemText({ ...item, detail }, t)}</b>
        <span>{t("sub", { source: sourceText(item.source, t), device: t(`devices.${item.device}`) })}</span>
      </span>
      <span className="site-now__time">
        <LeadWhen at={item.at} />
      </span>
    </li>
  );
}

type NowT = ReturnType<typeof useTranslations<"admin.home.now">>;

/** «instagram», «google.com» — как есть; без метки — «Прямой заход»; чужая метка — «Метка рекламы». */
function sourceText(source: string | null, t: NowT): string {
  if (!source) return t("direct");
  return source === OTHER_SOURCE ? t("otherSource") : source;
}

/** «Просмотр ЖК Shodlik», «Избранное · ЖК Bahor», «Поделились ссылкой · Telegram», «Фильтр: …». */
function itemText(item: SiteNowItem, t: NowT): string {
  const name = item.complex?.ru ?? null;
  if (item.type === "complex_view") return t("types.complex_view", { name: name ?? "—" });
  if (item.type === "filter") return t("types.filter", { detail: item.detail ?? "" });
  if (item.type === "ad_click" || item.type === "ad_view") return t(`types.${item.type}`, { name: item.ad?.ru ?? "—" });
  const text = t(`types.${item.type}`);
  if (name) return t("withComplex", { text, name });
  const detail = item.type === "share" && (item.detail === "telegram" || item.detail === "copy") ? t(`share.${item.detail}`) : item.detail;
  return detail ? t("withDetail", { text, detail }) : text;
}
