import type { ReactNode } from "react";

type AdminPageProps = {
  /** Верхняя строка раздела — AdminTopbar, у Главной — в Suspense (текущее время). */
  topbar: ReactNode;
  children: ReactNode;
};

/** Раздел кабинета: верхняя строка и содержимое с отступами мокапа (.adm__content). */
export function AdminPage({ topbar, children }: AdminPageProps) {
  return (
    <main className="admin-page">
      {topbar}
      <div className="admin-page__content">{children}</div>
    </main>
  );
}
