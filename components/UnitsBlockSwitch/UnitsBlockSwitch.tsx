import Link from "next/link";
import { useTranslations } from "next-intl";
import { segmentedItemClass } from "@/components/Segmented";
import type { UnitsBlock } from "@/lib/admin/units/types";

type UnitsBlockSwitchProps = {
  blocks: readonly UnitsBlock[];
  current: string;
  /** Адрес вкладки: блок — в ?blok= (планировки — выбранного блока, список читает экран). */
  href: string;
  /** Остальной запрос адреса, который надо сохранить (сценарий стенда ?demo=…). */
  query?: string | null;
};

/** «Блок A 88 · Блок B нет списка» — как переключатель «Планировок», но ссылками. */
export function UnitsBlockSwitch({ blocks, current, href, query = null }: UnitsBlockSwitchProps) {
  const t = useTranslations("admin.complexes.units");
  return (
    <nav className="segmented segmented--lg units-block-switch" aria-label={t("switch")}>
      {blocks.map((block) => (
        <Link
          key={block.id}
          href={`${href}?blok=${block.id}${query ? `&${query}` : ""}`}
          scroll={false}
          className={segmentedItemClass(block.id === current)}
          aria-current={block.id === current ? "page" : undefined}
        >
          {t("blockName", { name: block.name })}
          <span className="units-block-switch__count">
            {block.unitCount > 0 ? block.unitCount : t("noList")}
          </span>
        </Link>
      ))}
    </nav>
  );
}
