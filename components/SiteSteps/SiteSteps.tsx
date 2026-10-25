type SiteStepsProps = {
  steps: readonly { title: string; text: string }[];
  /** Микс с элементом блока-владельца по БЭМ. */
  className?: string;
};

/** Шаги мокапа («От заявки до первых продаж», «Как проходит покупка»): номер курсивом, заголовок, текст. */
export function SiteSteps({ steps, className }: SiteStepsProps) {
  return (
    <ol className={["site-steps", className].filter(Boolean).join(" ")}>
      {steps.map((step, index) => (
        <li key={step.title} className="site-steps__item">
          <span className="site-steps__number" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 className="site-steps__title">{step.title}</h3>
          <p className="site-steps__text">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
