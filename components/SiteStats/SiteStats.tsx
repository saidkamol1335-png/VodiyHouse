type SiteStatsProps = {
  /** Подпись ряда для диктора: «Vodiy House в цифрах». */
  label: string;
  items: readonly { key: string; value: string; caption: string }[];
  /** Микс с элементом блока-владельца по БЭМ: отступы и место задаёт его CSS. */
  className?: string;
};

/** Ряд цифр мокапа (.hero__stats): крупное число, под ним подпись моноширинным капсом; только из базы. */
export function SiteStats({ label, items, className }: SiteStatsProps) {
  if (items.length === 0) return null;
  return (
    <dl className={["site-stats", className].filter(Boolean).join(" ")} aria-label={label}>
      {items.map((item) => (
        <div key={item.key} className="site-stats__item">
          <dt className="site-stats__caption">{item.caption}</dt>
          <dd className="site-stats__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
