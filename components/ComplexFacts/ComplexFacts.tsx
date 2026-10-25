import { Building2, LayoutGrid, Layers, MapPin, MoveVertical, PaintRoller, SquareParking, Star, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { Fact } from "@/lib/site/complex/summary";

const ICONS: Record<Fact["key"], LucideIcon> = {
  class: Star,
  floors: Layers,
  houseType: Building2,
  ceilings: MoveVertical,
  finishing: PaintRoller,
  parking: SquareParking,
  toCenter: MapPin,
  blocks: LayoutGrid,
};

const CEILING = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

/** Плашки «О ЖК» (мокап .facts, ТЗ 7.3б): иконка, подпись, значение; пустое поле не выводится. */
export async function ComplexFacts({ facts }: { facts: readonly Fact[] }) {
  const t = await getTranslations("complex");
  const valueOf = (fact: Fact): string => {
    switch (fact.key) {
      case "class":
        return t(`class.${fact.value}`);
      case "floors":
        return t("about.floorsValue", { n: fact.value });
      case "houseType":
        return t(`about.houseType.${fact.value}`);
      case "ceilings":
        return t("about.ceilingsValue", { n: CEILING.format(fact.value) });
      case "parking":
        return t(`about.parking.${fact.value}`);
      case "toCenter":
        return t("about.toCenterValue", { n: fact.value });
      default:
        return fact.value.join(fact.key === "blocks" ? " · " : " / ");
    }
  };
  if (facts.length === 0) return null;
  return (
    <ul className="complex-facts">
      {facts.map((fact) => {
        const Icon = ICONS[fact.key];
        return (
          <li key={fact.key} className="complex-facts__item">
            <Icon size={20} strokeWidth={1.7} aria-hidden />
            <span className="complex-facts__label">{t(`about.facts.${fact.key}`)}</span>
            <span className="complex-facts__value">{valueOf(fact)}</span>
          </li>
        );
      })}
    </ul>
  );
}
