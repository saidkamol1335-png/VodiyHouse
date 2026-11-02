import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/Logo";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

/** Логотип в боковом меню: «Vodiy House» и подпись «Кабинет · Проект-1». */
export async function AdminBrand() {
  const t = await getTranslations("admin");
  return (
    <Link className="admin-brand" href={ADMIN_ROUTES.home}>
      <LogoMark className="admin-brand__mark" />
      <span>
        <span className="admin-brand__name">Vodiy House</span>
        <span className="admin-brand__sub">
          {t("brand")} · {t("brandSub")}
        </span>
      </span>
    </Link>
  );
}
