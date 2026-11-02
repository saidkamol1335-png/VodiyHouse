import { getTranslations } from "next-intl/server";
import { blockCard } from "@/lib/site/complex/blocks";
import { cheapestCalculable, layoutCards } from "@/lib/site/complex/layouts";
import type { ComplexPage } from "@/lib/site/complex/model";
import { BlockCard } from "./BlockCard";
import { BlockTabs } from "./BlockTabs";

/** «Блоки и условия покупки» (мокап .blocks, ТЗ 7.3в): карточка на блок; один блок — без вкладок. */
export async function ComplexTerms({ page }: { page: ComplexPage }) {
  const t = await getTranslations("complex.blocks");
  const cards = page.blocks.map((block) => blockCard(page, block));
  const layouts = layoutCards(page);
  if (cards.length === 0) return null;
  const tabs = cards.map(({ block, status }) => ({
    id: block.id,
    name: t("block", { name: block.name }),
    status: status.kind === "built" ? t("built") : status.pct === null ? t("building") : t("buildingPct", { pct: status.pct }),
  }));
  return (
    <div className="complex-terms">
      <h3 className="complex-terms__title">{t("title")}</h3>
      <BlockTabs label={t("title")} tabs={tabs}>
        {cards.map((card) => (
          <BlockCard key={card.block.id} card={card} calcLayoutId={cheapestCalculable(layouts, card.block.id)} />
        ))}
      </BlockTabs>
    </div>
  );
}
