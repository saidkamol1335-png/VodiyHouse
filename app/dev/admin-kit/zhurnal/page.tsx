import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";

export default function DevAdminKitLogPage() {
  const t = useTranslations("admin.developers");
  return <AdminPanel title={t("tabs.log")}>{t("later")}</AdminPanel>;
}
