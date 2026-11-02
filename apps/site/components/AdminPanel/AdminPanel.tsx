import type { ReactNode } from "react";

type AdminPanelProps = {
  title: string;
  children: ReactNode;
  /** Форма: без ограничения ширины текста и обычным цветом. */
  wide?: boolean;
};

/** Панель кабинета (мокап: .panel): заголовок и содержимое. */
export function AdminPanel({ title, children, wide = false }: AdminPanelProps) {
  return (
    <section className="admin-panel">
      <h2 className="admin-panel__title">{title}</h2>
      <div className={wide ? "admin-panel__body admin-panel__body--wide" : "admin-panel__body"}>
        {children}
      </div>
    </section>
  );
}
