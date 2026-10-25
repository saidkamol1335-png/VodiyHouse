import { Calculator } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { TermHint } from "@/components/TermHint";
import { formatPercent, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { BlockCard as BlockCardModel, ProgramLine } from "@/lib/site/complex/blocks";
import { layoutsLink } from "@/lib/site/complex/layoutsLink";

type Translator = Awaited<ReturnType<typeof getTranslations<"complex">>>;

/** «16–18%» или «17,5%»: ставка банка или наценка по строкам сроков. */
const rateText = (rate: NonNullable<ProgramLine["rate"]>) =>
  rate.min === rate.max ? formatPercent(rate.min) : `${formatPercent(rate.min).replace("%", "")}–${formatPercent(rate.max)}`;

/** Строка «Как можно купить» без скидок (PLAN §3.13): «100% оплата», «взнос от 30%, до 36 мес.»… */
export function programText(t: Translator, line: ProgramLine, locale: Locale): string {
  const down = formatPercent(line.downPct);
  const bank = line.bank?.[locale] ?? "";
  const rate = line.rate ? rateText(line.rate) : "";
  switch (line.kind) {
    case "full":
      return t("blocks.program.full");
    case "scheme":
      return t("blocks.program.scheme", { down, months: line.months });
    case "markup":
      return t("blocks.program.markup", { down, months: line.months, rate });
    case "bank":
      return t("blocks.program.bank", { bank, down, months: line.months, rate });
    default:
      return line.months >= 60 && line.months % 12 === 0
        ? t("blocks.program.mortgage", { bank, years: line.months / 12, down, rate })
        : t("blocks.program.mortgageMonths", { bank, months: line.months, down, rate });
  }
}

type BlockCardProps = {
  card: BlockCardModel;
  /** У блока есть планировки на сайте — «Рассчитать платёж» ведёт к ним. */
  calculable: boolean;
};

/**
 * Карточка блока (мокап .blk, ТЗ 7.3в): статус и готовность, срок с переносом и «Историей сроков»,
 * отделка с «?», кадастр, в продаже, способы покупки, «Что входит в цену», «Платёж от».
 */
export async function BlockCard({ card, calculable }: BlockCardProps) {
  const t = await getTranslations("complex");
  const locale = (await getLocale()) as Locale;
  return (
    <article className="complex-block">
      <BlockHead card={card} t={t} locale={locale} />
      <BlockFacts card={card} t={t} locale={locale} />
      {card.programs.length > 0 ? (
        <div>
          <p className="complex-block__label">{t("blocks.howToBuy")}</p>
          <ul className="complex-block__programs">
            {card.programs.map((line) => (
              <li key={line.id}>
                <span className="complex-block__mark">{line.mark}</span>
                <span>{programText(t, line, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <BlockIncludes card={card} t={t} locale={locale} />
      <BlockFoot card={card} t={t} locale={locale} calculable={calculable} />
    </article>
  );
}

type PartProps = { card: BlockCardModel; t: Translator; locale: Locale };

/** «Блок B · Строится · 58%» и полоса готовности «7 из 12 этажей» (только у строящегося). */
function BlockHead({ card, t }: PartProps) {
  const { block, status, floors } = card;
  const pct = status.kind === "building" && status.pct !== null ? status.pct : floors ? (floors.built / floors.total) * 100 : 0;
  return (
    <>
      <header className="complex-block__head">
        <h4 className="complex-block__name">{t("blocks.block", { name: block.name })}</h4>
        <span className={status.kind === "built" ? "complex-block__status complex-block__status--built" : "complex-block__status"}>
          {status.kind === "built" ? t("blocks.built") : status.pct === null ? t("blocks.building") : t("blocks.buildingPct", { pct: status.pct })}
        </span>
      </header>
      {floors ? (
        <div className="complex-block__progress">
          <span className="complex-block__bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${pct / 100})` }} />
          </span>
          <p className="complex-block__floors">{t("blocks.floors", floors)}</p>
        </div>
      ) : null}
    </>
  );
}

const quarterOf = (t: Translator, value: { year: number; quarter: number }) => t("quarter", { q: value.quarter, year: value.year });

function cadastreText(t: Translator, cadastre: BlockCardModel["cadastre"]): string | null {
  if (cadastre?.kind === "done") return t("blocks.cadastreDone");
  if (cadastre?.kind === "afterDelivery") return t("blocks.cadastreAfter");
  if (cadastre?.kind !== "inProgress") return null;
  return cadastre.expected ? t("blocks.cadastreExpected", { quarter: quarterOf(t, cadastre.expected) }) : t("blocks.cadastreInProgress");
}

function inSaleText(t: Translator, block: BlockCardModel["block"]): string | null {
  if (block.free !== null) return t("blocks.flats", { n: block.free });
  return block.offers.some((offer) => offer.available) ? t("blocks.inStock") : null;
}

function BlockFacts({ card, t, locale }: PartProps) {
  const { block } = card;
  const cadastre = cadastreText(t, card.cadastre);
  const inSale = inSaleText(t, block);
  return (
    <dl className="complex-block__facts">
      <DeadlineRow card={card} t={t} locale={locale} />
      {block.finishing ? (
        <div>
          <dt>{t("blocks.finishing")}</dt>
          <dd>
            {block.finishing.name[locale]}
            {block.finishingHint ? <TermHint label={t("blocks.hint", { term: block.finishing.name[locale] })} text={block.finishingHint[locale]} /> : null}
          </dd>
        </div>
      ) : null}
      {cadastre ? (
        <div>
          <dt>{t("blocks.cadastre")}</dt>
          <dd>{cadastre}</dd>
        </div>
      ) : null}
      {inSale ? (
        <div>
          <dt>{t("blocks.inSale")}</dt>
          <dd>{inSale}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Срок сдачи и перенос «· перенесён с 2 кв. 2027» — раскрывает «Историю сроков» (ТЗ 7.3в). */
function DeadlineRow({ card, t }: PartProps) {
  const { block, shift } = card;
  if (!block.deadline) return null;
  const deadline = quarterOf(t, block.deadline);
  return (
    <div>
      <dt>{t("blocks.deadline")}</dt>
      <dd>
        {block.buildStatus === "delivered" ? t("blocks.builtIn", { quarter: deadline }) : deadline}
        {shift ? (
          <details className="complex-block__history">
            <summary>{t("blocks.shifted", { quarter: quarterOf(t, shift.from) })}</summary>
            <p className="complex-block__label">{t("blocks.history")}</p>
            <ul>
              {block.history.map((entry) => (
                <li key={`${entry.changedOn}-${entry.to.year}-${entry.to.quarter}`}>
                  {t("blocks.historyItem", {
                    from: quarterOf(t, entry.from),
                    to: quarterOf(t, entry.to),
                    date: entry.changedOn.split("-").reverse().join("."),
                  })}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </dd>
    </div>
  );
}

/** «Что входит в цену» (Ф4, ТЗ 7.3в): пункт — «входит» или «отдельно, от $5 000»; пусто — нет строки. */
function BlockIncludes({ card, t, locale }: PartProps) {
  const { block } = card;
  if (block.priceIncludes.length === 0) return null;
  return (
    <div>
      <p className="complex-block__label">{t("blocks.includes")}</p>
      <ul className="complex-block__includes">
        {block.priceIncludes.map((item) => (
          <li key={item.item.ru}>
            <span>{item.item[locale]}</span>
            <b>
              {item.included
                ? t("blocks.included")
                : item.price
                  ? t("blocks.extraFrom", {
                      price: formatPrice(item.price, block.currency, locale),
                    })
                  : t("blocks.extra")}
            </b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** «Платёж от $603/мес» и «Рассчитать платёж» — к планировкам этого блока. */
function BlockFoot({ card, t, locale, calculable }: PartProps & { calculable: boolean }) {
  const { block, payment } = card;
  if (!payment && !calculable) return null;
  return (
    <footer className="complex-block__foot">
      {payment ? <span className="complex-block__payment">{t("blocks.monthlyFrom", { price: formatPrice(payment, block.currency, locale) })}</span> : null}
      {calculable ? (
        <a className="complex-block__calc" href={layoutsLink({ blockId: block.id })}>
          <Calculator size={16} strokeWidth={1.9} aria-hidden />
          {t("blocks.calculate")}
        </a>
      ) : null}
    </footer>
  );
}
