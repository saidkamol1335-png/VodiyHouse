type SiteStepsProps = {
  steps: readonly { title: string; text: string }[];
  /** Уровень заголовка шага: h3 под h2 раздела («Застройщикам»), h2 прямо под h1 («Как купить»). */
  level?: 2 | 3;
  /** list — столбиком в узкой колонке текста («Как купить»); row — в ряд, как в мокапе. */
  layout?: "row" | "list";
  className?: string;
};

/** Шаги мокапа («От заявки до первых продаж», «Как проходит покупка»): номер курсивом, заголовок, текст. */
export function SiteSteps({ steps, level = 3, layout = "row", className }: SiteStepsProps) {
  const Title = `h${level}` as const;
  return (
    <ol
      className={["site-steps", `site-steps--${layout}`, className].filter(Boolean).join(" ")}
      style={{ ["--site-steps" as string]: steps.length }}
    >
      {steps.map((step, index) => (
        <li key={step.title} className="site-steps__item">
          <span className="site-steps__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Title className="site-steps__title">{step.title}</Title>
          <p className="site-steps__text">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
