import { Check, Send } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { PhoneButton } from "@/components/PhoneButton";
import { type SiteContacts, phoneHref, telegramHref } from "@/lib/contacts";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { CardDeadline } from "@/lib/site/catalog/card";
import type { ComplexSummary } from "@/lib/site/complex/summary";

type ComplexOfferProps = {
  summary: ComplexSummary;
  /** Контакты Vodiy House (Ф9) — единственные на сайте (правило ТЗ 1.2). */
  contacts: SiteContacts;
};

/**
 * Главное за 10 секунд (ТЗ 7.1, мокап .jki; телефон — .sum): в продаже, цена «от» и за м², платёж,
 * срок сдачи, проверенные документы, связь с Vodiy House и плашка «Для вас бесплатно». Без скидок
 * (PLAN §3.13); «Записаться на просмотр» — с заявками (шаг 3.7), «Подарок» — со спецпредложениями (3б).
 */
export async function ComplexOffer({ summary, contacts }: ComplexOfferProps) {
  const t = await getTranslations("complex.offer");
  const locale = (await getLocale()) as Locale;
  const { price } = summary;
  const money = (amount: number) => formatPrice(amount, price?.currency ?? "USD", locale);
  return (
    <section className="complex-offer" aria-label={t("inSale")}>
      <div className={contacts.phone || contacts.telegram ? "complex-offer__top" : "complex-offer__top complex-offer__top--no-cta"}>
        <div className="complex-offer__price">
          <p className="complex-offer__live">
            <i aria-hidden="true" />
            {summary.free === null ? t("inSale") : `${t("inSale")} · ${t("flats", { n: summary.free })}`}
          </p>
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
        <OfferContacts contacts={contacts} />
      </div>
      <OfferFree contacts={contacts} locale={locale} />
    </section>
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

/** «Показать телефон» и Telegram Vodiy House; на телефоне — «Позвонить» и «Telegram» (мокап .two). */
async function OfferContacts({ contacts }: { contacts: SiteContacts }) {
  const [t, tContacts] = await Promise.all([getTranslations("complex.offer"), getTranslations("contacts")]);
  if (!contacts.phone && !contacts.telegram) return null;
  return (
    <div className="complex-offer__cta">
      {contacts.phone ? <PhoneButton phone={contacts.phone} className="complex-offer__phone" /> : null}
      {contacts.phone ? (
        <a className="complex-offer__button complex-offer__button--call" href={phoneHref(contacts.phone)}>
          {t("call")}
        </a>
      ) : null}
      {contacts.telegram ? (
        <a
          className="complex-offer__button complex-offer__button--telegram"
          href={telegramHref(contacts.telegram)}
          target="_blank"
          rel="noopener"
          aria-label={t("telegram")}
        >
          <Send size={16} strokeWidth={1.9} aria-hidden />
          <span className="complex-offer__telegram-text">{tContacts("telegram")}</span>
        </a>
      ) : null}
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
