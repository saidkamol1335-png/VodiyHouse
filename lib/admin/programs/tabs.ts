import type { AdminTab } from "@/components/AdminTabs";

// Вкладки «Программ оплаты» (Р1, решение экранов «Адреса»): список программ и «Расчёт для
// клиента» — отдельные адреса; менеджеру меню открывает сразу расчёт (lib/admin/nav.ts).
export const CALC_SEGMENT = "raschet";

export function programsTabs(base: string, labels: { list: string; calc: string }): AdminTab[] {
  return [
    { segment: null, href: base, label: labels.list },
    { segment: CALC_SEGMENT, href: `${base}/${CALC_SEGMENT}`, label: labels.calc },
  ];
}
