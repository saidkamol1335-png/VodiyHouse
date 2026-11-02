import type { ReactNode } from "react";
import { AdminBrand } from "@/components/AdminBrand";
import { AdminNav } from "@/components/AdminNav";
import { AdminUser } from "@/components/AdminUser";
import type { CabinetViewer } from "@/lib/admin/access";
import { visibleNav } from "@/lib/admin/nav";
import { cabinetPerson } from "@/lib/admin/person";

type AdminShellProps = {
  viewer: CabinetViewer;
  children: ReactNode;
};

/** Оболочка кабинета: боковая панель 250 px (≥ 981 px) или лента пилюль (≤ 980 px) + раздел. */
export async function AdminShell({ viewer, children }: AdminShellProps) {
  const person = await cabinetPerson(viewer);
  const items = visibleNav(viewer.role).map(({ key, href, section }) => ({ key, href, section }));
  return (
    <div className="admin-shell">
      <aside className="admin-shell__side">
        <AdminBrand />
        <AdminNav items={items} variant="side" />
        <AdminUser person={person} />
      </aside>
      <div className="admin-shell__main">
        <AdminNav items={items} variant="strip" />
        {children}
      </div>
    </div>
  );
}
