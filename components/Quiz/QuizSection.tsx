import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Container } from "@/components/Container";
import { pickMessages, QUIZ_MESSAGES } from "@/lib/i18n/clientMessages";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { Quiz, type QuizVariant } from "./Quiz";

type QuizSectionProps = {
  /** Якорь раздела (QUIZ_ANCHOR): кнопка первого экрана ведёт сюда. */
  id: string;
  catalog: SiteCatalog | null;
  variant: QuizVariant;
};

/** Раздел квиза (3.17): на главной — между предложениями и «в двух словах», на /podbor — вся страница. */
export async function QuizSection({ id, catalog, variant }: QuizSectionProps) {
  const messages = await getMessages();
  return (
    <section id={id} className={`quiz-section quiz-section--${variant}`} aria-labelledby={`${id}-title`}>
      <Container>
        <NextIntlClientProvider messages={pickMessages(messages, QUIZ_MESSAGES)}>
          <Quiz id={id} catalog={catalog} variant={variant} />
        </NextIntlClientProvider>
      </Container>
    </section>
  );
}
