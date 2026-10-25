import { useTranslations } from "next-intl";
import { Button } from "@/components/Button";
import { segmentedItemClass } from "@/components/Segmented";
import type { BlockLayouts } from "@/lib/admin/complexes/layouts";

type BlockSwitchProps = {
  blocks: readonly BlockLayouts[];
  current: string;
  onSwitch: (id: string) => void;
};

/** «Блок A · Блок B», как на сайте; «Все блоки» нет — новая планировка не попадёт в чужой блок. */
export function BlockSwitch({ blocks, current, onSwitch }: BlockSwitchProps) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="segmented segmented--lg complex-layouts__switch" role="group" aria-label={t("switch")}>
      {blocks.map((item) => (
        <button
          key={item.blockId}
          type="button"
          className={segmentedItemClass(item.blockId === current)}
          aria-pressed={item.blockId === current}
          onClick={() => onSwitch(item.blockId)}
        >
          {t("blockName", { name: item.blockName })}
          <span className="complex-layouts__count">{item.layouts.length}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyBlock({ others, onCopy }: { others: readonly BlockLayouts[]; onCopy: (from: BlockLayouts) => void }) {
  const t = useTranslations("admin.complexes.layouts");
  return (
    <div className="complex-layouts__empty">
      <p>{t("empty")}</p>
      {others.map((other) => (
        <Button key={other.blockId} size="sm" variant="ghost" onClick={() => onCopy(other)}>
          {t("copyFrom", { name: other.blockName, count: other.layouts.length })}
        </Button>
      ))}
    </div>
  );
}
