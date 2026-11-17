"use client";

import { useTranslations } from "next-intl";
import { ActionToast } from "@/components/ActionToast";
import { AdminPanel } from "@/components/AdminPanel";
import { Switch } from "@/components/Switch";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { useSettingSwitch } from "@/lib/ui/useSettingSwitch";

type DiscountsPanelProps = {
  enabled: boolean;
  action: (enabled: boolean) => Promise<HouseAdResult>;
};

/**
 * «Скидки на сайте» над списком спецпредложений (правки 15.11, п. 4 + 21): по умолчанию выключено —
 * спецпредложения со скидкой (слово «скидка» или «−N%» в бейдже, заголовке или тексте) сайт не
 * показывает нигде; включил руководитель — показывает как обычные.
 */
export function DiscountsPanel({ enabled: initial, action }: DiscountsPanelProps) {
  const t = useTranslations("admin");
  const { enabled, pending, change, toast, closeToast } = useSettingSwitch(initial, action, {
    turnedOn: t("discounts.turnedOn"),
    turnedOff: t("discounts.turnedOff"),
  });
  return (
    <AdminPanel title={t("discounts.title")} wide>
      <div className="discounts-panel">
        <p className="discounts-panel__lead">{t("discounts.lead")}</p>
        <Switch
          checked={enabled}
          label={t(enabled ? "discounts.on" : "discounts.off")}
          accessibleName={t("discounts.switch")}
          onChange={change}
          disabled={pending}
        />
      </div>
      <ActionToast message={toast} closeLabel={t("filterArchive.close")} onClose={closeToast} />
    </AdminPanel>
  );
}
