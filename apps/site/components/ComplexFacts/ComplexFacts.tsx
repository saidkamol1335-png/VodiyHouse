import { getTranslations } from "next-intl/server";
import type { CardDeadline } from "@/lib/site/catalog/card";
import type { Fact } from "@/lib/site/complex/summary";
import { FactsSteps, type FactStep } from "./FactsSteps";

const CEILING = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

type ComplexFactsProps = {
  facts: readonly Fact[];
  deadline: CardDeadline;
};

/**
 * «О ЖК» (мокап .facts, ТЗ 7.3б): факты ЖК — шаги вертикальной ленты по образцу «How I work» портфолио
 * исполнителя (04.11.2026): подпись — что это, крупно — значение; срок сдачи — последним шагом. Пустое
 * поле не выводится.
 */
export async function ComplexFacts({ facts, deadline }: ComplexFactsProps) {
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
  const steps: FactStep[] = facts.map((fact) => ({
    id: fact.key,
    label: t(`about.facts.${fact.key}`),
    value: valueOf(fact),
  }));
  if (deadline) {
    steps.push({
      id: "deadline",
      label: t("offer.deadline"),
      value:
        deadline.kind === "built"
          ? t("offer.built")
          : t("quarter", { q: deadline.quarter, year: deadline.year }),
    });
  }
  if (steps.length === 0) return null;
  return <FactsSteps steps={steps} />;
}
