"use client";

import { useCallback, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import type { ToastMessage } from "@/components/ActionToast";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { settle } from "@/lib/ui/settle";

const NO_CONNECTION: HouseAdResult = { status: "error", error: "network" };

/**
 * Тумблер публичной настройки сайта («Своя реклама Vodiy House», «Скидки на сайте»): ответ сервера —
 * новое состояние и полоса с итогом (texts — что сказать после включения и выключения); обрыв связи —
 * «нет связи».
 */
export function useSettingSwitch(
  initial: boolean,
  action: (enabled: boolean) => Promise<HouseAdResult>,
  texts: { turnedOn: string; turnedOff: string },
) {
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
      setToast({ id: Date.now(), tone: "success", text: result.enabled ? texts.turnedOn : texts.turnedOff });
    });
  return { enabled, pending, change, toast, closeToast };
}
