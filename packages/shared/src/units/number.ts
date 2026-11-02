// Номер квартиры: те же правила, что у базы (check таблицы units и private.is_unit_number), и
// тот же порядок, что в SQL (числовой префикс, затем текст): 2 < 10 < 12 < 12А < 13.

/** Как в базе: до 10 цифр, латинских и русских букв, «/» и «-». Ё база не пропускает. */
export const UNIT_NUMBER_PATTERN = /^[0-9A-Za-zА-Яа-я/-]{1,10}$/;

// Латинские буквы, неотличимые от русских: «12A» и «12А» база считает разными номерами, а
// человек — одним. Графику номера не меняем (у застройщика может быть и узбекская латиница —
// «12a, 12d», и кириллица): двойники совпадают только при сравнении — поиск, подтверждение.
const LATIN_TWINS: Record<string, string> = {
  A: "А",
  B: "В",
  C: "С",
  E: "Е",
  H: "Н",
  K: "К",
  M: "М",
  O: "О",
  P: "Р",
  T: "Т",
  X: "Х",
};

/** «12a » → «12A»: без пробелов и заглавными, в той графике, в какой ввели. */
export function normalizeUnitNumber(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Ключ сравнения: латинские двойники — русскими буквами («12A» и «12А» — одно). */
export function foldUnitNumber(raw: string): string {
  return normalizeUnitNumber(raw).replace(/[A-Z]/g, (letter) => LATIN_TWINS[letter] ?? letter);
}

export function isUnitNumber(raw: string): boolean {
  return UNIT_NUMBER_PATTERN.test(raw.trim());
}

function numericPrefix(number: string): number | null {
  const match = /^[0-9]+/.exec(number);
  return match ? Number(match[0]) : null;
}

/** Порядок номеров как в SQL: по числовому префиксу (без него — в конце), затем по тексту. */
export function compareUnitNumbers(a: string, b: string): number {
  const left = numericPrefix(a);
  const right = numericPrefix(b);
  if (left !== right) {
    if (left === null) return 1;
    if (right === null) return -1;
    return left - right;
  }
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Поиск по номеру: «12а», «12A» и «12А» находят одну квартиру. */
export function unitNumberMatches(number: string, query: string): boolean {
  const wanted = foldUnitNumber(query);
  return wanted === "" || foldUnitNumber(number).includes(wanted);
}
