import { useTranslations } from "next-intl";
import { deliveryOf, type LeadRow } from "@/lib/admin/leads/screen";
import { LEAD_CHANNELS } from "@/lib/leads/types";

/**
 * «Доставка» (мокап CabLeads: «TG», «Таблица»): зелёная — доставлено, янтарная — в очереди,
 * красная — не доставлено, пунктир — канал не подключён (заявка только в кабинете).
 */
export function LeadDeliveryMarks({ row }: { row: Pick<LeadRow, "deliveries"> }) {
  const t = useTranslations("admin.leads");
  return (
    <span className="lead-delivery">
      {LEAD_CHANNELS.map((channel) => {
        const state = deliveryOf(row, channel);
        return (
          <span
            key={channel}
            className={`lead-delivery__mark lead-delivery__mark--${state}`}
            title={t("delivery.stateLabel", { channel: t(`channelNames.${channel}`), state: t(`delivery.states.${state}`) })}
          >
            {t(`channels.${channel}`)}
            <span className="sr-only">{` · ${t(`delivery.states.${state}`)}`}</span>
          </span>
        );
      })}
    </span>
  );
}
