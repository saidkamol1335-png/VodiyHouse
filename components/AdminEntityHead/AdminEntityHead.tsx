import type { ReactNode } from "react";
import { AdminTabs, type AdminTab } from "@/components/AdminTabs";
import { PublicationBadge } from "@/components/PublicationBadge";
import type { PublicationStatus } from "@/lib/admin/publication";

type AdminEntityHeadProps = {
  status: PublicationStatus;
  tabsLabel: string;
  tabs: readonly AdminTab[];
  /** Плашка статуса с кнопками («Опубликовать», «В архив»…) вместо простой плашки. */
  statusControls?: ReactNode;
};

/** Шапка страницы ЖК или застройщика: статус публикации и вкладки (решения в. 6 и Д2). */
export function AdminEntityHead({ status, tabsLabel, tabs, statusControls }: AdminEntityHeadProps) {
  return (
    <div className="admin-entity-head">
      {statusControls ?? <PublicationBadge status={status} />}
      <AdminTabs label={tabsLabel} tabs={tabs} />
    </div>
  );
}
