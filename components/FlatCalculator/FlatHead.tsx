"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/Eyebrow";
import { approxIn, type CalcLocale, moneyIn } from "@/components/PaymentCalculator/calcText";
import type { FlatCalcScreen } from "@/lib/calc/flatScreen";
import type { CalcProgram } from "@/lib/calc/programs";
import type { CalcView } from "@/lib/calc/view";
import { mediaPublicUrl } from "@/lib/media";

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

type FlatHeadProps = {
  id: string;
  screen: FlatCalcScreen;
  view: CalcView<CalcProgram>;
  locale: CalcLocale;
  onClose: () => void;
};

/**
 * Шапка расчёта квартиры (мокап SiteJkCalc1, MobFlat): чертёж, «3-комн. · 78 м²», ЖК, блок и
 * застройщик, справа — стоимость выбранной квартиры, «Кв. 8 · 3 эт. · $704/м²» и «≈ … сум».
 */
export function FlatHead({ id, screen, view, locale, onClose }: FlatHeadProps) {
  const t = useTranslations("calc");
  const title = t("flat.title", {
    rooms: t("price.rooms", { count: screen.layout.rooms }),
    area: AREA.format(screen.layout.area),
  });
  const planUrl = drawingUrl(screen.layout.drawing);
  return (
    <header className={planUrl ? "flat-calc__head flat-calc__head--plan" : "flat-calc__head"}>
      {planUrl ? (
        <figure className="flat-calc__plan">
          {/* eslint-disable-next-line @next/next/no-img-element -- чертёж из бакета, размеры неизвестны */}
          <img src={planUrl} alt={t("flat.plan", { title })} loading="lazy" decoding="async" />
        </figure>
      ) : null}
      {/* Заголовок и «Закрыть» — одна строка: в шторке она прилипает к верху (MobFlatTerm). */}
      <div className="flat-calc__bar">
        <div className="flat-calc__heading">
          <Eyebrow>{t("flat.eyebrow")}</Eyebrow>
          <h2 id={`${id}-title`} className="flat-calc__title" tabIndex={-1}>
            {title}
          </h2>
          <p className="flat-calc__place">
            {t("flat.place", {
              complex: screen.complexName[locale],
              block: screen.blockName,
              developer: screen.developerName,
            })}
          </p>
        </div>
        <button
          type="button"
          className="flat-calc__close"
          aria-label={t("flat.close")}
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <FlatPrice screen={screen} view={view} locale={locale} />
    </header>
  );
}

/**
 * Чертёж планировки из медиа ЖК; чертежа (или облака) нет — места под него нет. Путь с «/» — файл
 * сайта (DEMO стенда), путь базы — всегда папка бакета media.
 */
function drawingUrl(drawing: string | null): string | null {
  if (drawing?.startsWith("/")) return drawing;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return drawing && base ? mediaPublicUrl(base, drawing) : null;
}

type FlatPriceProps = Pick<FlatHeadProps, "screen" | "view" | "locale">;

function FlatPrice({ screen, view, locale }: FlatPriceProps) {
  const t = useTranslations("calc");
  const { price, currency, perM2 } = view.price;
  if (price === null) return null;
  const rate = screen.data.rate;
  const unit = screen.data.stock.units.find((item) => item.id === view.price.unitId);
  const approx = approxIn(price, currency, currency, rate, locale);
  const perM2Text = perM2 === null ? null : moneyIn(perM2, currency, currency, null, locale);
  const details = [
    unit ? t("flat.unit", { number: unit.number, floor: unit.floor }) : null,
    perM2Text ? t("flat.perM2", { amount: perM2Text }) : null,
    approx ? t("price.approx", { amount: approx }) : null,
  ].filter(Boolean);
  return (
    <div className="flat-calc__price">
      <span className="flat-calc__price-label">
        {view.price.mode === "unit" ? t("flat.price") : t("flat.priceFrom")}
      </span>
      <b className="flat-calc__price-value">{moneyIn(price, currency, currency, null, locale)}</b>
      <span className="flat-calc__price-details">{details.join(" · ")}</span>
    </div>
  );
}
