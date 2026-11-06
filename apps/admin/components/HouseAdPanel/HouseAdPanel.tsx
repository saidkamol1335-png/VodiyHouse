"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { ActionToast, type ToastMessage } from "@/components/ActionToast";
import { AdminPanel } from "@/components/AdminPanel";
import { Switch } from "@/components/Switch";
import type { HouseAdResult } from "@/lib/admin/actions/houseAd";
import { settle } from "@/lib/ui/settle";

type HouseAdPanelProps = {
  enabled: boolean;
  /** Название действующей рекламы застройщика (она важнее своей); null — такой нет. */
  activeAd: string | null;
  /** Главная сайта, раздел рекламы. */
  siteHref: string;
  action: (enabled: boolean) => Promise<HouseAdResult>;
};

const NO_CONNECTION: HouseAdResult = { status: "error", error: "network" };

/**
 * «Своя реклама Vodiy House» над очередью рекламы (06.11.2026): пока у застройщиков нет действующей
 * рекламы, сайт собирает её из каталога. Тумблер — показывать или нет; ниже — что сейчас на главной.
 */
export function HouseAdPanel({ enabled: initial, activeAd, siteHref, action }: HouseAdPanelProps) {
  const t = useTranslations("admin");
  const { enabled, pending, change, toast, closeToast } = useHouseAdSwitch(initial, action);
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

/** Тумблер: ответ сервера — новое состояние и полоса с итогом; обрыв связи — «нет связи». */
function useHouseAdSwitch(initial: boolean, action: HouseAdPanelProps["action"]) {
  const t = useTranslations("admin");
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const change = (next: boolean) =>
    startTransition(async () => {
      const result = await settle(() => action(next), NO_CONNECTION);
      if (result.status === "error") {
        setToast({ id: Date.now(), tone: "error", text: t(`developers.errors.${result.error}`) });
        return;
      }
      setEnabled(result.enabled);
      setToast({
        id: Date.now(),
        tone: "success",
        text: t(result.enabled ? "houseAd.turnedOn" : "houseAd.turnedOff"),
      });
    });
  return { enabled, pending, change, toast, closeToast };
}
