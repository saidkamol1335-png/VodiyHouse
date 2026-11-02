// Адрес на сайте из названия (/zastroyshchiki/fargona-sifat-qurilish): латиница, цифры и
// дефисы — как check slug в базе. Кириллица (русская и узбекская) — по узбекской латинице:
// руководитель может набрать название и кириллицей. Апострофы o‘ g‘ просто убираются.

export const SLUG_MAX_LENGTH = 60;
// «demo-…» — пометка DEMO-данных: npm run demo:remove удаляет всё с этим префиксом.
const RESERVED = /^demo(-|$)/;
const RESERVED_PREFIX = "z-";

const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  ғ: "g",
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
  ў: "o",
  ф: "f",
  х: "x",
  ҳ: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const APOSTROPHES = /['‘’ʻʼ`´]/g;
const COMBINING_MARKS = /\p{M}/gu;

function toLatin(text: string): string {
  const lower = text.normalize("NFC").toLowerCase();
  const transliterated = Array.from(lower, (letter) => CYRILLIC[letter] ?? letter).join("");
  // Остальные буквы с диакритикой (é, ö) — без знаков: e, o.
  return transliterated.normalize("NFKD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** Адрес из текста; пусто — если в тексте нет ни буквы, ни цифры. */
export function slugify(text: string): string {
  const slug = toLatin(text)
    .replace(APOSTROPHES, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= SLUG_MAX_LENGTH) return slug;
  // Обрезаем по границе слова, чтобы не оставить «-qurili».
  const cut = slug.slice(0, SLUG_MAX_LENGTH + 1);
  const lastDash = cut.lastIndexOf("-");
  return (lastDash > 0 ? cut.slice(0, lastDash) : slug.slice(0, SLUG_MAX_LENGTH)).replace(
    /-+$/,
    "",
  );
}

/** Адрес настоящей записи: не пустой и не похожий на DEMO. */
export function contentSlug(text: string, fallback: string): string {
  const slug = slugify(text) || fallback;
  return RESERVED.test(slug) ? `${RESERVED_PREFIX}${slug}` : slug;
}
