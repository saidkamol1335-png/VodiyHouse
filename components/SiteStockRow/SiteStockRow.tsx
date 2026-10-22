import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { SiteStockDetails } from "@/components/SiteStockDetails";
import { StockBadge } from "@/components/StockBadge";
import { StockRooms } from "@/components/StockRooms";
import type { SiteStockComplex } from "@/lib/admin/home/siteStock";

type SiteStockRowProps = {
  complex: SiteStockComplex;
  open: boolean;
  onToggle: (id: string) => void;
  /** Номер вспышки пилюли (0 — не было): новый номер перезапускает анимацию. */
  flash: number;
  unitsHref: string;
};

/**
 * Строка «Остатков» (мокап .ostl__r): название, город · застройщик, комнаты моноширинным,
 * «свободно N». Тап раскрывает её на месте (Г3 B); открыта одна — решает панель.
 */
export function SiteStockRow({ complex, open, onToggle, flash, unitsHref }: SiteStockRowProps) {
  const t = useTranslations("admin.complexes");
  const detailsId = `site-stock-${complex.id}`;
  const where = [complex.locationName ?? t("noLocation"), complex.developerName].join(" · ");
  return (
    <li className={open ? "site-stock-row site-stock-row--open" : "site-stock-row"}>
      <button
        type="button"
        className="site-stock-row__toggle"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => onToggle(complex.id)}
      >
        <span className="site-stock-row__main">
          <span className="site-stock-row__name">{t("namePrefixed", { name: complex.name })}</span>
          <span className="site-stock-row__meta">{where}</span>
        </span>
        <StockRooms stock={complex.stock} className="site-stock-row__rooms" />
        <span className="site-stock-row__stock">
          <StockBadge
            key={flash}
            stock={complex.stock}
            unassigned={complex.unassigned}
            flash={flash > 0}
          />
        </span>
        <ChevronDown className="site-stock-row__chevron" size={16} aria-hidden="true" />
      </button>
      <SiteStockDetails
        id={detailsId}
        complex={complex}
        where={where}
        unitsHref={unitsHref}
        hidden={!open}
      />
    </li>
  );
}
