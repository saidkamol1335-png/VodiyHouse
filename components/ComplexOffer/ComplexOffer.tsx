import { CalendarCheck, Check, Send } from "lucide-react";
import { Beam } from "@/components/Beam";
import { getLocale, getTranslations } from "next-intl/server";
import { LeadButton } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import type { LeadObject } from "@/lib/leads/types";
import { PhoneButton } from "@/components/PhoneButton";
import { TelegramButton } from "@/components/TelegramButton";
import { type SiteContacts, phoneHref } from "@/lib/contacts";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { CardDeadline } from "@/lib/site/catalog/card";
import type { ComplexSummary } from "@/lib/site/complex/summary";

type ComplexOfferProps = {
  /** «ЖК Shodlik» — подпись карточки для диктора (мокап: aria-label .jki). */
  name: string;
  /** Адрес ЖК — заявка «Записаться на просмотр» знает, о каком ЖК (база проверит сама). */
  slug: string;
  summary: ComplexSummary;
  /** Контакты Vodiy House (Ф9) — единственные на сайте (правило ТЗ 1.2). */
  contacts: SiteContacts;
};

/**
 * Главное за 10 секунд (ТЗ 7.1, мокап .jki; телефон — .sum): в продаже, цена «от» и за м², платёж,
 * срок сдачи, проверенные документы, «Записаться на просмотр» (форма 10.1), связь с Vodiy House и
 * плашка «Для вас бесплатно». Без скидок (PLAN §3.13); «Подарок» — со спецпредложениями (3б).
 */
export async function ComplexOffer({ name, slug, summary, contacts }: ComplexOfferProps) {
  const t = await getTranslations("complex.offer");
  const locale = (await getLocale()) as Locale;
  const { price } = summary;
  const money = (amount: number) => formatPrice(amount, price?.currency ?? "USD", locale);
  return (
    <section className="complex-offer" aria-label={name}>
      {/* Луч по рамке (мокап .jki.beam): только в full, вне экрана — на паузе. */}
      <Beam />
      <div className="complex-offer__top">
        <div className="complex-offer__price">
          <OfferLive free={summary.free} />
          <p className="complex-offer__amount">{price ? t("priceFrom", { price: money(price.amount) }) : t("priceOnRequest")}</p>
          {price?.perM2 ? <p className="complex-offer__per-m2">{t("perM2From", { price: money(price.perM2) })}</p> : null}
        </div>
        <dl className="complex-offer__facts">
          {price?.payment ? (
            <div className="complex-offer__fact">
              <dt>{t("monthly")}</dt>
              <dd className="complex-offer__fact-value complex-offer__fact-value--accent">{t("monthlyFrom", { price: money(price.payment) })}</dd>
            </div>
          ) : null}
          <OfferDeadline deadline={summary.deadline} />
          {summary.documents > 0 ? (
            <div className="complex-offer__fact">
              <dt>{t("documents")}</dt>
              <dd className="complex-offer__fact-value complex-offer__fact-value--ok">
                <Check size={16} strokeWidth={2.4} aria-hidden />
                {t("documentsChecked", { n: summary.documents })}
              </dd>
            </div>
          ) : null}
        </dl>
        <OfferContacts contacts={contacts} book={{ type: "view", object: { complex: slug }, context: name }} />
      </div>
      <OfferFree contacts={contacts} locale={locale} />
    </section>
  );
}

/** «В продаже · 41 квартира»; всё продано или в брони — без зелёной точки «в продаже». */
async function OfferLive({ free }: { free: number | null }) {
  const t = await getTranslations("complex.offer");
  if (free === 0) return <p className="complex-offer__live">{t("soldOut")}</p>;
  return (
    <p className="complex-offer__live">
      <i aria-hidden="true" />
      {free === null ? t("inSale") : `${t("inSale")} · ${t("flats", { n: free })}`}
    </p>
  );
}

async function OfferDeadline({ deadline }: { deadline: CardDeadline }) {
  const [t, tComplex] = await Promise.all([getTranslations("complex.offer"), getTranslations("complex")]);
  if (!deadline) return null;
  const quarter = deadline.kind === "until" ? tComplex("quarter", { q: deadline.quarter, year: deadline.year }) : "";
  const text = deadline.kind === "built" ? t("built") : deadline.partlyBuilt ? t("partBuilt", { q: quarter }) : quarter;
  return (
    <div className="complex-offer__fact">
      <dt>{t("deadline")}</dt>
      <dd className="complex-offer__fact-value">{text}</dd>
    </div>
  );
}

type OfferContactsProps = { contacts: SiteContacts; book: LeadIntent };

/**
 * «Записаться на просмотр» во всю ширину, под ней «Показать телефон» и Telegram Vodiy House; на
 * телефоне — «Позвонить» и «Telegram» пополам (мокап .jki__cta, .sum__cta).
 */
async function OfferContacts({ contacts, book }: OfferContactsProps) {
  const [t, tContacts, tLead] = await Promise.all([
    getTranslations("complex.offer"),
    getTranslations("contacts"),
    getTranslations("lead.buttons"),
  ]);
  return (
    <div className="complex-offer__cta">
      <LeadButton intent={book} block className="complex-offer__book">
        <CalendarCheck size={18} aria-hidden="true" />
        {tLead("view")}
      </LeadButton>
      {contacts.phone || contacts.telegram || contacts.bot ? (
        <OfferLinks contacts={contacts} t={t} telegramText={tContacts("telegram")} object={book.object ?? {}} />
      ) : null}
    </div>
  );
}

type OfferLinksProps = {
  contacts: SiteContacts;
  t: Awaited<ReturnType<typeof getTranslations<"complex.offer">>>;
  telegramText: string;
  object: LeadObject;
};

function OfferLinks({ contacts, t, telegramText, object }: OfferLinksProps) {
  return (
    <div className="complex-offer__links">
      {contacts.phone ? <PhoneButton phone={contacts.phone} className="complex-offer__phone" /> : null}
      {contacts.phone ? (
        <a className="complex-offer__button complex-offer__button--call" href={phoneHref(contacts.phone)}>
          {t("call")}
        </a>
      ) : null}
      <TelegramButton object={object} className="complex-offer__button complex-offer__button--telegram" aria-label={t("telegram")}>
        <Send size={16} strokeWidth={1.9} aria-hidden />
        <span className="complex-offer__telegram-text">{telegramText}</span>
      </TelegramButton>
    </div>
  );
}

/** Плашка «Для вас бесплатно» (ТЗ 7.1): пункты — «Настройки → Контакты»; без пунктов плашки нет. */
async function OfferFree({ contacts, locale }: { contacts: SiteContacts; locale: Locale }) {
  const t = await getTranslations("complex.offer");
  if (contacts.freeServices.length === 0) return null;
  const badge = contacts.freeBadge?.[locale] ?? t("freeBadge");
  return (
    <div className="complex-offer__free">
      <p className="complex-offer__free-title">{`${t("freePrice")} ${badge}:`}</p>
      <ul className="complex-offer__free-list">
        {contacts.freeServices.map((service) => (
          <li key={service.ru}>
            <Check size={16} strokeWidth={2.2} aria-hidden />
            {service[locale]}
          </li>
        ))}
      </ul>
    </div>
  );
}
