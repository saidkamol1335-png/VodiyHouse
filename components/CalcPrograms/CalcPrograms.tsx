export type CalcProgramChoice = {
  id: string;
  /** Знак-инициалы банка или застройщика (мокап: FS, IB). */
  mark: string;
  title: string;
  /** У банка — вид программы: «Рассрочка через банк». */
  subtitle: string | null;
  note: string;
  /** «Shodlik, блок A» — у программы, ограниченной блоками. */
  place: string | null;
};

type CalcProgramsProps = {
  /** Имя группы радиокнопок — уникально на странице. */
  name: string;
  legend: string;
  choices: readonly CalcProgramChoice[];
  value: string | null;
  onChange: (id: string) => void;
  empty: string;
};

/**
 * Выбор программы (мокап r1 и MobFlat): на 1440 — карточки в две колонки, на телефоне —
 * список с кружком справа. Радиокнопки настоящие — стрелки клавиатуры и диктор работают сами.
 */
export function CalcPrograms({ name, legend, choices, value, onChange, empty }: CalcProgramsProps) {
  return (
    <fieldset className="calc-programs">
      <legend className="calc-programs__legend">{legend}</legend>
      {choices.length === 0 ? <p className="calc-programs__empty">{empty}</p> : null}
      <div className="calc-programs__grid">
        {choices.map((choice) => (
          <label key={choice.id} className="calc-programs__card">
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={choice.id === value}
              onChange={() => onChange(choice.id)}
              className="calc-programs__input"
            />
            <span className="calc-programs__mark" aria-hidden="true">
              {choice.mark}
            </span>
            <span className="calc-programs__text">
              <b className="calc-programs__title">{choice.title}</b>
              {choice.subtitle ? (
                <span className="calc-programs__subtitle">{choice.subtitle}</span>
              ) : null}
              <span className="calc-programs__note">{choice.note}</span>
              {choice.place ? <span className="calc-programs__place">{choice.place}</span> : null}
            </span>
            <span className="calc-programs__radio" aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
