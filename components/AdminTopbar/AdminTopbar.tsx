import { AdminUserMenu } from "@/components/AdminUserMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { CabinetPerson } from "@/lib/admin/person";

type AdminTopbarProps = {
  title: string;
  subtitle?: string;
  person: CabinetPerson;
  /** Заглушка, пока заголовок с текущим временем приходит с сервера: высота строки сохраняется. */
  pending?: boolean;
};

/** Верхняя строка раздела (К4): заголовок и подпись слева, ☀/☾ и сотрудник справа. */
export function AdminTopbar({ title, subtitle, person, pending = false }: AdminTopbarProps) {
  return (
    <header className={pending ? "admin-topbar admin-topbar--pending" : "admin-topbar"}>
      <div className="admin-topbar__text">
        <h1 className="admin-topbar__title">{pending ? " " : title}</h1>
        {subtitle || pending ? <p className="admin-topbar__subtitle">{pending ? " " : subtitle}</p> : null}
      </div>
      <div className="admin-topbar__tools">
        <ThemeToggle className="icon-button--sm" />
        <AdminUserMenu person={person} />
      </div>
    </header>
  );
}
