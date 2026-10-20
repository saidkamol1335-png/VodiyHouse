"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormStatus } from "@/components/FormStatus";

/** Сюда отключённого сотрудника ведёт кабинет: /admin/vhod?prichina=otklyuchen (lib/admin/landing.ts). */
export function LoginNotice() {
  const reason = useSearchParams().get("prichina");
  const t = useTranslations("admin.login.notice");
  return reason === "otklyuchen" ? <FormStatus tone="notice">{t("disabled")}</FormStatus> : null;
}
