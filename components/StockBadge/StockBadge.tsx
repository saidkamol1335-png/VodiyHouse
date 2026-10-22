import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import { stockBadgeView, type ComplexStock, type StockTone } from "@/lib/admin/complexes/stock";

const TONES: Record<StockTone, BadgeTone> = { none: "neutral", low: "amber", ok: "ok" };

type StockBadgeProps = {
  stock: ComplexStock;
  /** «live» принёс другое число (главная) — пилюля вспыхивает, как в мокапе. */
  flash?: boolean;
};

/** Пилюля остатков ЖК — одна у списка «ЖК» и «Остатков по ЖК» на главной. */
export function StockBadge({ stock, flash = false }: StockBadgeProps) {
  const t = useTranslations("admin.complexes.stock");
  const view = stockBadgeView(stock);
  const text =
    view.text === "free" || view.text === "freePartial"
      ? t(view.text, { count: view.count })
      : t(view.text);
  return (
    <Badge
      tone={TONES[view.tone]}
      className={flash ? "stock-badge stock-badge--flash" : "stock-badge"}
    >
      {text}
    </Badge>
  );
}
