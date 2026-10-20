import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";

export default function DevAdminKitPrivatePage() {
  const t = useTranslations("admin.developers");
  return <AdminPanel title={t("tabs.private")}>{t("later")}</AdminPanel>;
}
