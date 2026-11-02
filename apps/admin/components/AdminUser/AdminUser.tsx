import { Avatar } from "@/components/Avatar";
import { LogoutButton } from "@/components/LogoutButton";
import type { CabinetPerson } from "@/lib/admin/person";

/** Карточка сотрудника внизу боковой панели: инициалы, имя, роль, выход (мокап: .adm__user). */
export function AdminUser({ person }: { person: CabinetPerson }) {
  return (
    <div className="admin-user">
      <Avatar name={person.name} />
      <span className="admin-user__text">
        <span className="admin-user__name" title={person.name}>
          {person.name}
        </span>
        <span className="admin-user__role">{person.roleLabel}</span>
      </span>
      <LogoutButton variant="icon" />
    </div>
  );
}
