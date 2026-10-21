import Link from "next/link";
import { useTranslations } from "next-intl";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";

export type BlockUnitsLine = { blockId: string; name: string; units: number; free: number | null };

type ComplexUnitsSummaryProps = {
  blocks: readonly BlockUnitsLine[];
  /** Пустые состояния ведут на следующий шаг («реши сам» шага 11). */
  blocksHref: string;
  layoutsHref: string;
};

/** Вкладка «Квартиры» до шага 12: по каждому блоку — есть ли список квартир и сколько свободно. */
export function ComplexUnitsSummary({ blocks, blocksHref, layoutsHref }: ComplexUnitsSummaryProps) {
  const t = useTranslations("admin.complexes.units");
  return (
    <AdminPanel title={t("title")} wide>
      <p className="complex-units__lead">{t("lead")}</p>
      {blocks.length === 0 ? (
        <p className="complex-units__empty">
          {t("empty")} <Link href={blocksHref}>{t("toBlocks")}</Link>
        </p>
      ) : (
        <ul className="complex-units__rows">
          {blocks.map((block) => (
            <li key={block.blockId} className="complex-units__row">
              <b>{t("blockName", { name: block.name })}</b>
              {block.units > 0 ? (
                <>
                  <span>{t("listed", { count: block.units })}</span>
                  <Badge tone="ok">{t("free", { count: block.free ?? 0 })}</Badge>
                </>
              ) : (
                <span className="complex-units__none">
                  {t("noList")} <Link href={layoutsHref}>{t("toLayouts")}</Link>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  );
}
