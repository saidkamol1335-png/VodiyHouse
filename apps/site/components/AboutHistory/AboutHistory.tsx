import { getLocale, getTranslations } from "next-intl/server";
import type { AboutEvent } from "@vh/shared/about";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import type { Locale } from "@/lib/i18n/routing";

/**
 * «Tarix» / «История» на /o-nas (правки 15.11, п. 25; образец — «История» Uzum): события по годам —
 * год крупно, заголовок и короткий текст. Ведёт руководитель («Настройки → О компании»); пусто — нет.
 */
export async function AboutHistory({ events }: { events: readonly AboutEvent[] }) {
  if (events.length === 0) return null;
  const [t, locale] = await Promise.all([getTranslations("about.history"), getLocale()]);
  const lang = locale as Locale;
  return (
    <section className="about-history" aria-labelledby="about-history-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="about-history-title" className="about-history__title">
          <Heading level={2}>{t("title")}</Heading>
        </div>
        <ol className="about-history__list">
          {events.map((event, index) => (
            <li key={`${event.year}-${index}`} className="about-history__item">
              <span className="about-history__year">{event.year}</span>
              <div>
                <h3 className="about-history__name">{event.title[lang]}</h3>
                {event.text ? <p className="about-history__text">{event.text[lang]}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
