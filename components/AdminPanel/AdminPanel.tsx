import type { ReactNode } from "react";

type AdminPanelProps = {
  title: string;
  children: ReactNode;
};

/** Панель кабинета (мокап: .panel): заголовок и содержимое. */
export function AdminPanel({ title, children }: AdminPanelProps) {
  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">{title}</h2>
      <div className="admin-panel__body">{children}</div>
    </section>
  );
}
