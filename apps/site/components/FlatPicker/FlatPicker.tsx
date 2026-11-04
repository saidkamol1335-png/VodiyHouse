import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { flatFrames } from "@/lib/site/home/flatFrames";
import { flatTabs, type FlatTab } from "@/lib/site/home/flatPicker";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { formatArea, formatPrice, formatPriceShort } from "@vh/shared/format";
import {
  FlatPickerStage,
  type FlatFigure,
  type FlatPickerTab,
  type FlatPickerText,
} from "./FlatPickerStage";

type Translate = Awaited<ReturnType<typeof getTranslations<"home.flatPicker">>>;

/**
 * «Выберите свою квартиру» (PLAN §10, п. 47; Motion Kit №18): квартира без крыши выезжает из-за
 * вордмарка VODIY и поворачивается из вида сверху в 3/4, вкладки 1/2/3 комнаты (и 4+, если есть кадры).
 * Цифры — тем же фильтром, что каталог; нет квартир или кадров типа — нет вкладки, нет вкладок — нет
 * секции (кадров пока нет: на проде её нет, в разработке — заглушка при VH_DEMO_SECTIONS=1).
 */
export async function FlatPicker({ catalog }: { catalog: SiteCatalog }) {
  const tabs = flatTabs(catalog, (rooms) => flatFrames(rooms) !== null);
  if (tabs.length === 0) return null;
  const [t, locale] = await Promise.all([
    getTranslations("home.flatPicker"),
    getLocale() as Promise<Locale>,
  ]);
  const views: FlatPickerTab[] = tabs.map((tab) => tabView(tab, t, locale));
  const text: FlatPickerText = {
    lead: t("lead"),
    wordmark: t("wordmark"),
    caption: t("caption"),
    tablist: t("tablist"),
    tableTitle: t("table.title"),
    rows: (
      ["area", "price", "perM2", "flats", "complexes", "deadline", "installment"] as const
    ).map((key) => t(`table.${key}`)),
  };
  return <FlatPickerStage tabs={views} text={text} />;
}

function tabView(tab: FlatTab, t: Translate, locale: Locale): FlatPickerTab {
  const usd = (amount: number) => formatPrice(amount, "USD", locale);
  // У всех подходящих типов наличие без числа — не «от 0 квартир», а «есть в продаже».
  const unknown = tab.partial && tab.flats === 0;
  const flats = unknown
    ? t("flatsUnknown")
    : t("flats", { n: tab.flats, partial: String(tab.partial) });
  const deadline =
    tab.deadline?.kind === "built"
      ? t("built")
      : tab.deadline
        ? t("quarter", { q: tab.deadline.quarter, year: tab.deadline.year })
        : null;
  const key = String(tab.rooms) as "1" | "2" | "3" | "4";
  return {
    rooms: tab.rooms,
    frames: flatFrames(tab.rooms)!,
    label: t(`tabs.${key}`),
    name: t(`names.${key}`),
    lines: [t(`lines.${key}.a`), t(`lines.${key}.b`)],
    figures: tabFigures(tab, flats, t, locale),
    features: [
      deadline ? t("feature.deadline", { value: deadline }) : null,
      tab.installmentMonths ? t("feature.installment", { n: tab.installmentMonths }) : null,
      tab.perM2Usd !== null ? t("feature.perM2", { value: usd(tab.perM2Usd) }) : null,
      t("feature.price"),
    ].filter((feature) => feature !== null),
    cta: t("cta", { n: tab.flats, partial: String(tab.partial) }),
    href: `${ROUTES.catalog}${tab.search}`,
    table: [
      tab.areaFrom !== null ? t("from", { value: formatArea(tab.areaFrom, locale) }) : "—",
      tab.priceUsd !== null ? t("from", { value: usd(tab.priceUsd) }) : "—",
      tab.perM2Usd !== null ? t("from", { value: usd(tab.perM2Usd) }) : "—",
      flats,
      String(tab.complexes),
      deadline ?? "—",
      tab.installmentMonths ? t("months", { n: tab.installmentMonths }) : "—",
    ],
  };
}

/** «Площадь от», «Цена от» (≈ в сумах по курсу ЦБ) и «N квартир в M ЖК». */
function tabFigures(tab: FlatTab, flats: string, t: Translate, locale: Locale): FlatFigure[] {
  const figures: (FlatFigure | null)[] = [
    tab.areaFrom !== null
      ? { label: t("figure.area"), value: t("from", { value: formatArea(tab.areaFrom, locale) }) }
      : null,
    tab.priceUsd !== null
      ? {
          label: t("figure.price"),
          value: t("from", { value: formatPrice(tab.priceUsd, "USD", locale) }),
          note:
            tab.priceUzs !== null
              ? t("approx", { value: formatPriceShort(tab.priceUzs, "UZS", locale) })
              : null,
        }
      : null,
    { label: t("figure.stock"), value: t("stock", { flats, complexes: tab.complexes }) },
  ];
  return figures.filter((figure) => figure !== null);
}
