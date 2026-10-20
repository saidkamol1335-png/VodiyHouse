import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

/** Раздел не для этой роли (адрес открыли напрямую): объясняем и ведём на Главную. */
export function AdminDenied({ section }: { section: string }) {
  const t = useTranslations("admin.denied");
  return (
    <AdminPanel title={t("title")}>
      <p className="admin-denied__lead">{t("lead", { section })}</p>
      <Button href={ADMIN_ROUTES.home} variant="ghost" size="sm">
        {t("home")}
      </Button>
    </AdminPanel>
  );
}
