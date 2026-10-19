"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import type { CabinetPerson } from "@/lib/admin/person";

const PANEL_ID = "admin-user-menu";

/** До 980 px боковой панели нет — сотрудник и «Выйти» живут в аватаре верхней строки (К3.3). */
export function AdminUserMenu({ person }: { person: CabinetPerson }) {
  const t = useTranslations("admin.user");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={root} className="admin-user-menu">
      <button
        type="button"
        className="admin-user-menu__toggle"
        aria-label={t("menu", { name: person.name })}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={person.name} />
      </button>
      {open ? (
        <div id={PANEL_ID} className="admin-user-menu__panel">
          <p className="admin-user-menu__name">{person.name}</p>
          <p className="admin-user-menu__role">{person.roleLabel}</p>
          <Link className="admin-user-menu__logout" href={ADMIN_ROUTES.login}>
            <LogOut size={16} strokeWidth={1.8} aria-hidden />
            {t("logout")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
