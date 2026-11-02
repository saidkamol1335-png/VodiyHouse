import type { ReactNode } from "react";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";

type TextPageProps = {
  eyebrow: string;
  title: string;
  accent?: string;
  lead?: string;
  /** Разделы: заголовок и абзацы (в сообщениях — через пустую строку: массивов там нет). */
  sections?: readonly { key: string; title: string; text: string }[];
  /** Что-то своё между шапкой и разделами: шаги «Как купить». */
  children?: ReactNode;
  /** Под текстом: «Редакция от …», кнопка заявки. */
  footer?: ReactNode;
};

/** Текстовая страница сайта («Как купить», «Политика конфиденциальности»): шапка и разделы узкой колонкой. */
export function TextPage({ eyebrow, title, accent, lead, sections = [], children, footer }: TextPageProps) {
  return (
    <Container as="main">
      <article className="text-page">
        <header className="text-page__head">
          <Eyebrow>{eyebrow}</Eyebrow>
          <Heading level={1} accent={accent}>
            {title}
          </Heading>
          {lead ? <p className="text-page__lead">{lead}</p> : null}
        </header>
        {children}
        {sections.map((section) => (
          <section key={section.key} className="text-page__section" aria-labelledby={`text-page-${section.key}`}>
            <h2 id={`text-page-${section.key}`} className="text-page__title">
              {section.title}
            </h2>
            {section.text.split("\n\n").map((paragraph) => (
              <p key={paragraph} className="text-page__text">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        {footer ? <footer className="text-page__footer">{footer}</footer> : null}
      </article>
    </Container>
  );
}
