import { AdminTabs, type AdminTab } from "@/components/AdminTabs";
import { PublicationBadge } from "@/components/PublicationBadge";
import type { PublicationStatus } from "@/lib/admin/publication";

type AdminEntityHeadProps = {
  status: PublicationStatus;
  tabsLabel: string;
  tabs: readonly AdminTab[];
};

/** Шапка страницы ЖК или застройщика: статус публикации и вкладки (решения в. 6 и Д2). */
export function AdminEntityHead({ status, tabsLabel, tabs }: AdminEntityHeadProps) {
  return (
    <div className="admin-entity-head">
      <PublicationBadge status={status} />
      <AdminTabs label={tabsLabel} tabs={tabs} />
    </div>
  );
}
