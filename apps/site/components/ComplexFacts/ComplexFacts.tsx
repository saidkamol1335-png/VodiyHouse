import {
  BrickWall,
  Building2,
  CalendarCheck,
  Gem,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  MoveVertical,
  PaintRoller,
  SquareParking,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { CardDeadline } from "@/lib/site/catalog/card";
import type { Fact } from "@/lib/site/complex/summary";

const CEILING = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

type FactItem = { id: Fact["key"] | "deadline"; label: string; value: string };

const ICONS: Record<FactItem["id"], LucideIcon> = {
  class: Gem,
  floors: Building2,
  houseType: BrickWall,
  ceilings: MoveVertical,
  finishing: PaintRoller,
  parking: SquareParking,
  toCenter: MapPin,
  blocks: LayoutGrid,
  deadline: CalendarCheck,
};

type ComplexFactsProps = {
  facts: readonly Fact[];
  deadline: CardDeadline;
};

/**
 * «TJM haqida» (ТЗ 7.3б «плашки с иконками», мокап .facts; правки 15.11, п. 28): компактная сетка
 * «значок · подпись · значение» — все характеристики на одном экране (1440 — 5 в ряд, телефон — 2), как
 * характеристики ЖК на Cian. Срок сдачи — первым, как «Сдача» у Cian. Пустое поле не выводится. Без JS и
 * своей анимации: раздел проявляется целиком (ComplexSection).
 */
export async function ComplexFacts({ facts, deadline }: ComplexFactsProps) {
  const items = factItems(facts, deadline, await getTranslations("complex"));
  if (items.length === 0) return null;
  return (
    <dl className="complex-facts">
      {items.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <div key={item.id} className="complex-facts__item" data-fact={item.id}>
            <dt className="complex-facts__label">
              <Icon className="complex-facts__icon" size={20} strokeWidth={1.6} aria-hidden />
              {item.label}
            </dt>
            <dd className="complex-facts__value">{item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

type ComplexT = Awaited<ReturnType<typeof getTranslations<"complex">>>;

/** Плашки по порядку: срок сдачи — первым, затем факты из complexFacts. */
function factItems(facts: readonly Fact[], deadline: CardDeadline, t: ComplexT): FactItem[] {
  const items: FactItem[] = facts.map((fact) => ({
    id: fact.key,
    label: t(`about.facts.${fact.key}`),
    value: factValue(fact, t),
  }));
  if (deadline) {
    items.unshift({
      id: "deadline",
      label: t("offer.deadline"),
      value:
        deadline.kind === "built"
          ? t("offer.built")
          : t("quarter", { q: deadline.quarter, year: deadline.year }),
    });
  }
  return items;
}

function factValue(fact: Fact, t: ComplexT): string {
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
}
