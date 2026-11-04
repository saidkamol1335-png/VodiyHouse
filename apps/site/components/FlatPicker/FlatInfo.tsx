import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { FlatPickerTab, FlatPickerText } from "./FlatPickerStage";

/** Текст вкладки: название — по буквам, описание и цифры — по строкам, CTA в каталог с фильтром. */
export function TabPanel({ tab }: { tab: FlatPickerTab }) {
  return (
    <div
      id="flat-picker-panel"
      className="flat-picker__info"
      role="tabpanel"
      aria-labelledby={`flat-picker-tab-${tab.rooms}`}
    >
      <TabName name={tab.name} />
      <p className="flat-picker__lines">
        {tab.lines.map((line, index) => (
          <span key={line} className="flat-picker__line" style={{ ["--i" as string]: index }}>
            {line}
          </span>
        ))}
      </p>
      <TabFigures tab={tab} />
      <Link href={tab.href} className="button button--primary flat-picker__cta">
        {tab.cta}
        <ArrowRight size={16} strokeWidth={1.8} aria-hidden />
      </Link>
    </div>
  );
}

function TabName({ name }: { name: string }) {
  const letters = [...name];
  return (
    <h3 className="flat-picker__name">
      <span className="sr-only">{name}</span>
      <span aria-hidden>
        {letters.map((letter, index) => (
          <span
            key={index}
            className="flat-picker__letter"
            style={{ ["--i" as string]: index / letters.length, ["--n" as string]: letters.length }}
          >
            {letter}
          </span>
        ))}
      </span>
    </h3>
  );
}

function TabFigures({ tab }: { tab: FlatPickerTab }) {
  return (
    <dl className="flat-picker__figures">
      {tab.figures.map((figure, index) => (
        <div
          key={figure.label}
          className="flat-picker__figure flat-picker__line"
          style={{ ["--i" as string]: index + 2 }}
        >
          <dt>{figure.label}</dt>
          <dd>
            {figure.value}
            {figure.note ? <span className="flat-picker__note">{figure.note}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Фичи справа: пунктирные кружки-буллеты. */
export function FlatFeatures({ tab }: { tab: FlatPickerTab }) {
  return (
    <ul className="flat-picker__features">
      {tab.features.map((feature, index) => (
        <li key={feature} className="flat-picker__feature" style={{ ["--i" as string]: index }}>
          <span className="flat-picker__bullet" aria-hidden />
          {feature}
        </li>
      ))}
    </ul>
  );
}

const column = (index: number, active: number) =>
  index === active ? "flat-picker__col--active" : undefined;

type TableProps = { tabs: FlatPickerTab[]; text: FlatPickerText; active: number };

/** Сравнение типов: только поля, что есть в данных; каждая вторая строка — скруглённая полоса. */
export function FlatTable({ tabs, text, active }: TableProps) {
  return (
    <div className="flat-picker__table container">
      <h3 className="flat-picker__table-title">{text.tableTitle}</h3>
      <div className="flat-picker__table-scroll">
        <table className="flat-picker__grid">
          <thead>
            <tr>
              <td />
              {tabs.map((tab, index) => (
                <th key={tab.rooms} scope="col" className={column(index, active)}>
                  {tab.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {text.rows.map((row, rowIndex) => (
              <tr key={row}>
                <th scope="row">{row}</th>
                {tabs.map((tab, index) => (
                  <td key={tab.rooms} className={column(index, active)}>
                    {tab.table[rowIndex]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
