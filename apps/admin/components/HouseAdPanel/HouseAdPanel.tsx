"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { ActionToast } from "@/components/ActionToast";
import { AdminPanel } from "@/components/AdminPanel";
import { Switch } from "@/components/Switch";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { useSettingSwitch } from "@/lib/ui/useSettingSwitch";

type HouseAdPanelProps = {
  enabled: boolean;
  /** Название действующей рекламы застройщика (она важнее своей); null — такой нет. */
  activeAd: string | null;
  /** Главная сайта, раздел рекламы. */
  siteHref: string;
  action: (enabled: boolean) => Promise<HouseAdResult>;
};

/**
 * «Своя реклама Vodiy House» над очередью рекламы (06.11.2026): пока у застройщиков нет действующей
 * рекламы, сайт собирает её из каталога. Тумблер — показывать или нет; ниже — что сейчас на главной.
 */
export function HouseAdPanel({ enabled: initial, activeAd, siteHref, action }: HouseAdPanelProps) {
  const t = useTranslations("admin");
  const { enabled, pending, change, toast, closeToast } = useSettingSwitch(initial, action, {
    turnedOn: t("houseAd.turnedOn"),
    turnedOff: t("houseAd.turnedOff"),
  });
  const now = activeAd
    ? t("houseAd.nowPaid", { title: activeAd })
    : enabled
      ? t("houseAd.nowHouse")
      : t("houseAd.nowNone");
  return (
    <AdminPanel title={t("houseAd.title")} wide>
      <div className="house-ad">
        <p className="house-ad__lead">{t("houseAd.lead")}</p>
        <Switch
          checked={enabled}
          label={t(enabled ? "houseAd.on" : "houseAd.off")}
          accessibleName={t("houseAd.switch")}
          onChange={change}
          disabled={pending}
        />
        <p className="house-ad__now" data-testid="house-ad-now">
          {now}{" "}
          <a className="house-ad__link" href={siteHref} target="_blank" rel="noreferrer">
            {t("houseAd.open")}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        </p>
      </div>
      <ActionToast message={toast} closeLabel={t("filterArchive.close")} onClose={closeToast} />
    </AdminPanel>
  );
}
