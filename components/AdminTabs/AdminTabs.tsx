"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { useRef } from "react";
import { useStripScroll } from "@/lib/ui/useStripScroll";

export type AdminTab = {
  /** Сегмент адреса вкладки; null — вкладка по умолчанию (сам адрес раздела). */
  segment: string | null;
  href: string;
  label: string;
};

type AdminTabsProps = {
  label: string;
  tabs: readonly AdminTab[];
};

/**
 * Вкладки-пилюли страницы ЖК и застройщика (решения фазы 1, в. 6, и Д2). Каждая вкладка —
 * свой адрес: работает «назад», ссылку на вкладку можно отправить. Стоит в layout раздела.
 */
export function AdminTabs({ label, tabs }: AdminTabsProps) {
  const segment = useSelectedLayoutSegment();
  const track = useRef<HTMLDivElement>(null);
  const edges = useStripScroll(track, true, segment ?? "");

  return (
    <nav className="admin-tabs" aria-label={label}>
      <div
        ref={track}
        className="admin-tabs__track"
        data-fade-start={edges.start || undefined}
        data-fade-end={edges.end || undefined}
      >
        {tabs.map((tab) => {
          const active = tab.segment === segment;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={active ? "admin-tabs__tab admin-tabs__tab--active" : "admin-tabs__tab"}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
