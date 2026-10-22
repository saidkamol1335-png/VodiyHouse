import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { segmentedItemClass } from "@/components/Segmented";
import type { UnitsBlock } from "@/lib/admin/units/types";
import { SwitchPending } from "./SwitchPending";

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
  const format = useFormatter();
  return (
    <nav className="segmented segmented--lg units-block-switch" aria-label={t("switch")}>
      {blocks.map((block) => (
        <Link
          key={block.id}
          href={`${href}?blok=${block.id}${query ? `&${query}` : ""}`}
          scroll={false}
          className={`${segmentedItemClass(block.id === current)} units-block-switch__item`}
          aria-current={block.id === current ? "page" : undefined}
        >
          {t("blockName", { name: block.name })}
          {/* Диктору — «Блок A, 88 квартир»: голое число непонятно. */}
          {block.unitCount > 0 ? (
            <>
              <span className="units-block-switch__count" aria-hidden="true">
                {format.number(block.unitCount)}
              </span>
              <span className="sr-only">{t("switchUnits", { count: block.unitCount })}</span>
            </>
          ) : (
            <span className="units-block-switch__count">{t("noList")}</span>
          )}
          {/* Переход на свой же блок — не уход: блок остаётся, его правки и отказы — на месте. */}
          {block.id === current ? null : <SwitchPending />}
        </Link>
      ))}
    </nav>
  );
}
