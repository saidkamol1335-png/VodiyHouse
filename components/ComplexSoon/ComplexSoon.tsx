import { getTranslations } from "next-intl/server";
import { formatPhone, phoneHref } from "@/lib/contacts";
import { readSiteContacts } from "@/lib/site/contacts";

/**
 * Страница ЖК «Скоро» (docs/publication-rule.md): вместо планировок и расчёта — текст и общий номер
 * Vodiy House, тот же, что в шапке. Только телефон, без формы. Контактов застройщика здесь нет (ТЗ 1.2).
 */
export async function ComplexSoon({ id }: { id: string }) {
  const [t, contacts] = await Promise.all([getTranslations("complex.soon"), readSiteContacts()]);
  return (
    <section id={id} className="complex-soon">
      <p className="complex-soon__badge">{t("badge")}</p>
      <p className="complex-soon__text">{t(contacts.phone ? "text" : "textNoPhone")}</p>
      {contacts.phone ? (
        <a className="complex-soon__phone" href={phoneHref(contacts.phone)} data-track="phone_click">
          {formatPhone(contacts.phone)}
        </a>
      ) : null}
    </section>
  );
}
