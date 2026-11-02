// Русская и узбекская кириллица → узбекская латиница с заглавными, для подсказки UZ-названия
// при создании ЖК («реши сам» шага 11): «Шодлик» → «Shodlik». Апостроф — как в названиях мокапа
// (Farg‘ona): o‘, g‘. Это заготовка: руководитель видит UZ-поле и правит его сам.

const LETTERS: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "g‘",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  қ: "q",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ў: "o‘",
  ф: "f",
  х: "x",
  ҳ: "h",
  ц: "s",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "’",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const CYRILLIC = /[Ѐ-ӿ]/;

export const hasCyrillic = (text: string): boolean => CYRILLIC.test(text);

function letterToLatin(letter: string, next: string | undefined): string {
  const lower = letter.toLowerCase();
  const latin = LETTERS[lower];
  if (latin === undefined) return letter;
  if (lower === letter || !latin) return latin;
  // «Ш» в начале слова — «Sh», «ШК» целиком заглавными — «SHK».
  const nextIsUpper = next !== undefined && next !== next.toLowerCase();
  return nextIsUpper ? latin.toUpperCase() : latin.charAt(0).toUpperCase() + latin.slice(1);
}

/** Латинское название остаётся как есть: у большинства ЖК RU и UZ совпадают (Shodlik). */
export function toUzbekLatin(text: string): string {
  if (!hasCyrillic(text)) return text;
  const letters = Array.from(text.normalize("NFC"));
  return letters.map((letter, index) => letterToLatin(letter, letters[index + 1])).join("");
}
