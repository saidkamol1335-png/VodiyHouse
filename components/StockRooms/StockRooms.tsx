import { useTranslations } from "next-intl";
import type { ComplexStock } from "@/lib/admin/complexes/stock";

type StockRoomsProps = {
  stock: ComplexStock;
  /** Элемент хозяина (смешение по БЭМ): место в строке и перенос задаёт он. */
  className?: string;
};

/** «Ст 7 · 1к 10 · 4+ 3» моноширинным; тип без числа (по планировкам) — с галочкой «есть». */
export function StockRooms({ stock, className }: StockRoomsProps) {
  const t = useTranslations("admin.complexes.rooms");
  const text = stock.groups.map((item) => `${t(item.group)} ${item.free ?? "✓"}`).join(" · ");
  return <span className={className ? `stock-rooms ${className}` : "stock-rooms"}>{text}</span>;
}
