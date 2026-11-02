import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ADMIN_NAV, ADMIN_ROUTES, type AdminNavKey } from "@/lib/admin/nav";

type AdminDeniedProps = {
  section: string;
  /** Раздел меню: «ЖК» видит и менеджер (12.6) — тогда и текст об этом, а не «только руководитель». */
  sectionKey?: AdminNavKey;
};

/** Раздел не для этой роли (адрес открыли напрямую): объясняем и ведём на Главную. */
export function AdminDenied({ section, sectionKey }: AdminDeniedProps) {
  const t = useTranslations("admin.denied");
  const roles = ADMIN_NAV.find((item) => item.key === sectionKey)?.roles ?? ["head"];
  const staff = roles.includes("manager");
  return (
    <AdminPanel title={t(staff ? "titleStaff" : "title")}>
      <p className="admin-denied__lead">{t(staff ? "leadStaff" : "lead", { section })}</p>
      <Button href={ADMIN_ROUTES.home} variant="ghost" size="sm">
        {t("home")}
      </Button>
    </AdminPanel>
  );
}
