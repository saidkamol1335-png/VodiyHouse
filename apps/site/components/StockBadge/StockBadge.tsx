import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/Badge";
import { stockBadgeView, type ComplexStock, type StockTone } from "@/lib/admin/complexes/stock";

const TONES: Record<StockTone, BadgeTone> = { none: "neutral", low: "amber", ok: "ok" };

type StockBadgeProps = {
  stock: ComplexStock;
  /** Свободные без планировки: без типов ЖК иначе выглядел бы распроданным. */
  unassigned?: number;
  /** «live» принёс другое число (главная) — пилюля вспыхивает, как в мокапе. */
  flash?: boolean;
};

/** Пилюля остатков ЖК — одна у списка «ЖК» и «Остатков по ЖК» на главной (одно правило). */
export function StockBadge({ stock, unassigned = 0, flash = false }: StockBadgeProps) {
  const t = useTranslations("admin.complexes.stock");
  const view = stockBadgeView(stock, unassigned);
  const text =
    view.text === "none" || view.text === "byLayouts"
      ? t(view.text)
      : t(view.text, { count: view.count });
  return (
    <Badge
      tone={TONES[view.tone]}
      className={flash ? "stock-badge stock-badge--flash" : "stock-badge"}
    >
      {text}
      {/* Мокап на вспышке красит пилюлю янтарём с тёмным текстом; цвет не анимируем (CLAUDE.md
          §3) — поверх лежит слой с тем же текстом и гаснет прозрачностью. */}
      {flash ? (
        <span className="stock-badge__flash" aria-hidden="true">
          {text}
        </span>
      ) : null}
    </Badge>
  );
}
