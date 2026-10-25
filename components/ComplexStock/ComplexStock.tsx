import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatArea, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { layoutsLinkProps } from "@/lib/site/complex/layoutsLink";
import type { ComplexPage } from "@/lib/site/complex/model";
import { freeByBlock, type StockRow } from "@/lib/site/complex/stock";

type Translator = Awaited<ReturnType<typeof getTranslations<"complex">>>;

type ComplexStockProps = {
  page: ComplexPage;
  rows: readonly StockRow[];
  /** Всего свободно; null — у части блоков нет списка квартир. */
  free: number | null;
  /** Типы, у которых есть планировки на сайте: строка телефона ведёт к ним. */
  withLayouts: ReadonlySet<number>;
};

const roomsLabel = (t: Translator, rooms: number) => (rooms <= 4 ? t(`rooms.${rooms as 0 | 1 | 2 | 3 | 4}`) : t("rooms.more", { n: rooms }));

function leftText(t: Translator, row: StockRow): string {
  if (!row.available) return t("stock.leftNone");
  return row.free === null ? t("stock.leftUnknown") : t("stock.leftCount", { n: row.free });
}

/**
 * «Наличие квартир» (мокап .avl; телефон — .avb и строки со стрелкой): всего в продаже и по блокам,
 * по типам — площадь и цена «от», свободно по блокам и всего. Вместо «live» — «обновлено дд.мм,
 * чч:мм» в шапке раздела (PLAN §3.22); число на сайте меняется, как только менеджер отметит продажу.
 */
export async function ComplexStock({ page, rows, free, withLayouts }: ComplexStockProps) {
  const t = await getTranslations("complex");
  const locale = (await getLocale()) as Locale;
  const blocks = freeByBlock(page);
  const blocksText =
    blocks.length > 1
      ? blocks
          .map((block) => (block.free === null ? t("stock.blockFreeUnknown", { name: block.name }) : t("stock.blockFree", { name: block.name, n: block.free })))
          .join(" · ")
      : null;
  return (
    <div className="complex-stock">
      {free ? (
        <div className="complex-stock__total">
          <b className="complex-stock__number">{free}</b>
          <div>
            <p className="complex-stock__caption">{t("stock.inSale")}</p>
            {blocksText ? <p className="complex-stock__blocks">{blocksText}</p> : null}
          </div>
        </div>
      ) : null}
      <div className="complex-stock__table" role="table" aria-label={t("stock.title")}>
        <div className="complex-stock__row complex-stock__row--head" role="row">
          <span role="columnheader">{t("stock.type")}</span>
          <span role="columnheader">{t("stock.area")}</span>
          <span role="columnheader">{t("stock.price")}</span>
          <span role="columnheader">{t("stock.byBlocks")}</span>
          <span role="columnheader">{t("stock.left")}</span>
        </div>
        {rows.map((row) => (
          <StockLine key={row.rooms} row={row} t={t} locale={locale} multiBlock={page.blocks.length > 1} linked={withLayouts.has(row.rooms)} />
        ))}
      </div>
    </div>
  );
}

type StockLineProps = {
  row: StockRow;
  t: Translator;
  locale: Locale;
  multiBlock: boolean;
  linked: boolean;
};

/** «Бл. A: 6 · Бл. B: 8» — свободно по блокам, где тип есть в продаже. */
function byBlocksText(t: Translator, row: StockRow): string {
  return row.blocks
    .filter((entry) => entry.available)
    .map((entry) => (entry.free === null ? t("stock.blockFreeUnknown", { name: entry.blockName }) : t("stock.blockFree", { name: entry.blockName, n: entry.free })))
    .join(" · ");
}

/** «осталось 14 шт.»: мало (3 и меньше) — янтарём, нет — без заливки. */
function badgeClass(row: StockRow): string {
  if (!row.available) return "complex-stock__left complex-stock__left--none";
  return row.free !== null && row.free <= 3 ? "complex-stock__left complex-stock__left--few" : "complex-stock__left";
}

function StockLine({ row, t, locale, multiBlock, linked }: StockLineProps) {
  const areaText = row.areaFrom !== null ? formatArea(row.areaFrom, locale) : null;
  const priceText = row.price ? formatPrice(row.price.amount, row.price.currency, locale) : null;
  const type = roomsLabel(t, row.rooms);
  // Телефон: площадь и цена — одной строкой под типом (мокап MobJkAvail).
  const sub = areaText && priceText ? t("stock.rowSub", { area: areaText, price: priceText }) : null;
  return (
    <div className={row.available ? "complex-stock__row" : "complex-stock__row complex-stock__row--none"} role="row">
      <span className="complex-stock__type" role="cell">
        {linked ? (
          <a {...layoutsLinkProps({ rooms: row.rooms })} aria-label={t("stock.toLayouts", { type })}>
            {type}
          </a>
        ) : (
          type
        )}
        {sub ? <small className="complex-stock__sub">{sub}</small> : null}
      </span>
      <span className="complex-stock__area" role="cell">
        {areaText ? t("stock.areaFrom", { area: areaText }) : "—"}
      </span>
      <span className="complex-stock__price" role="cell">
        {priceText ? t("stock.priceFrom", { price: priceText }) : "—"}
      </span>
      <span className="complex-stock__by-blocks" role="cell">
        {multiBlock ? byBlocksText(t, row) : ""}
      </span>
      <span className="complex-stock__left-cell" role="cell">
        <span className={badgeClass(row)}>{leftText(t, row)}</span>
        {linked ? <ChevronRight className="complex-stock__chevron" size={16} strokeWidth={2} aria-hidden /> : null}
      </span>
    </div>
  );
}
