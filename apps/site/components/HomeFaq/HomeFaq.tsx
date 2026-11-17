import { getTranslations } from "next-intl/server";
import type { FaqItem } from "@vh/shared/faq";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { FaqAccordion } from "@/components/FaqAccordion";
import { Heading } from "@/components/Heading";

/**
 * «Частые вопросы» о Vodiy House на главной (правки 15.11, п. 7): после «Quruvchimisiz?»; вопросы и
 * ответы ведёт кабинет («Настройки → Частые вопросы»). Пусто — блока нет.
 */
export async function HomeFaq({ items }: { items: readonly FaqItem[] }) {
  if (items.length === 0) return null;
  const t = await getTranslations("home.faq");
  return (
    <section className="home-faq" aria-labelledby="home-faq-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="home-faq-title" className="home-faq__title">
          <Heading level={2}>{t("title")}</Heading>
        </div>
        <div className="home-faq__list">
          <FaqAccordion items={items} />
        </div>
      </Container>
    </section>
  );
}
