"use client";

import { House } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SiteStockView } from "@/components/SiteStockPanel";
import { siteStockTotal, type SiteStock } from "@/lib/admin/home/siteStock";
import { useLiveStock, type SiteStockRead } from "@/lib/admin/home/useLiveStock";
import { HomeCard } from "./HomeCard";

type HomeStockLiveProps = {
  /** Серверные карточки заявок («Новые», «В работе») — перед живой «Свободно на сайте». */
  cards: ReactNode;
  /** «Последние заявки» — между карточками и «Остатками по ЖК». */
  latest: ReactNode;
  initial: SiteStock | null;
  read: SiteStockRead;
  complexesHref: string;
};

/**
 * Главная кабинета (Г1 B): «Свободно на сайте» и «Остатки по ЖК» — из одного живого чтения (Г4 A):
 * панель перечитала остатки — цифра карточки та же, без второго опроса.
 */
export function HomeStockLive({ cards, latest, initial, read, complexesHref }: HomeStockLiveProps) {
  const t = useTranslations("admin.leads.home");
  const live = useLiveStock(initial, read);
  const { stock } = live;
  const total = stock ? siteStockTotal(stock) : null;
  return (
    <>
      <div className="home-leads__cards">
        {cards}
        {total && stock ? (
          <HomeCard
            icon={<House size={16} />}
            title={t("free")}
            value={total.free}
            sub={t("freeSub", { count: stock.complexes.length })}
            href={complexesHref}
            ok
          />
        ) : null}
      </div>
      {latest}
      <SiteStockView live={live} complexesHref={complexesHref} />
    </>
  );
}
