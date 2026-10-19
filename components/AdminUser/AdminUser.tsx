import { LogOut } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/Avatar";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { CabinetPerson } from "@/lib/admin/person";

/** Карточка сотрудника внизу боковой панели: инициалы, имя, роль, выход (мокап: .adm__user). */
export async function AdminUser({ person }: { person: CabinetPerson }) {
  const t = await getTranslations("admin.user");
  return (
    <div className="admin-user">
      <Avatar name={person.name} />
      <span className="admin-user__text">
        <span className="admin-user__name" title={person.name}>
          {person.name}
        </span>
        <span className="admin-user__role">{person.roleLabel}</span>
      </span>
      {/* Фаза 0: сессии нет, выход ведёт на экран входа; signOut Supabase — фаза 1. */}
      <Link className="icon-button icon-button--sm icon-button--bare" href={ADMIN_ROUTES.login} aria-label={t("logout")} title={t("logout")}>
        <LogOut size={18} strokeWidth={1.8} aria-hidden />
      </Link>
    </div>
  );
}
