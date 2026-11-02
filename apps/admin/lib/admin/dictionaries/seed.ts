import type { DictionaryItem, DictionaryKey } from "./definitions";

// Значения справочников для служебного стенда /dev/spravochniki — те же, что вставляет миграция
// 20261019160000_staff_dictionaries_audit.sql (это не DEMO: настоящие начальные данные).

type Seed = Omit<DictionaryItem, "id" | "isActive" | "second" | "kind"> &
  Partial<Pick<DictionaryItem, "second" | "kind">>;

const items = (seeds: readonly Seed[]): DictionaryItem[] =>
  seeds.map((seed, index) => ({
    id: index + 1,
    isActive: true,
    second: null,
    kind: null,
    ...seed,
  }));

const location = (
  slug: string,
  ru: string,
  uz: string,
  kind: "city" | "district",
  sort: number,
): Seed => ({
  slug,
  name: { ru, uz },
  kind,
  sort,
});

export const SEED_DICTIONARIES: Record<DictionaryKey, DictionaryItem[]> = {
  locations: items([
    location("fergana", "Фергана", "Farg‘ona", "city", 10),
    location("kokand", "Коканд", "Qo‘qon", "city", 20),
    location("margilan", "Маргилан", "Marg‘ilon", "city", 30),
    location("kuvasay", "Кувасай", "Quvasoy", "city", 40),
    location("altiarik", "Алтыарыкский район", "Oltiariq tumani", "district", 110),
    location("bagdad", "Багдадский район", "Bag‘dod tumani", "district", 120),
    location("beshariq", "Бешарыкский район", "Beshariq tumani", "district", 130),
    location("buvayda", "Бувайдинский район", "Buvayda tumani", "district", 140),
    location("dangara", "Дангаринский район", "Dang‘ara tumani", "district", 150),
    location("fergana-district", "Ферганский район", "Farg‘ona tumani", "district", 160),
    location("furqat", "Фуркатский район", "Furqat tumani", "district", 170),
    location("qushtepa", "Куштепинский район", "Qo‘shtepa tumani", "district", 180),
    location("quva", "Кувинский район", "Quva tumani", "district", 190),
    location("rishtan", "Риштанский район", "Rishton tumani", "district", 200),
    location("sokh", "Сохский район", "So‘x tumani", "district", 210),
    location("tashlak", "Ташлакский район", "Toshloq tumani", "district", 220),
    location("uchkuprik", "Учкуприкский район", "Uchko‘prik tumani", "district", 230),
    location("uzbekistan", "Узбекистанский район", "O‘zbekiston tumani", "district", 240),
    location("yazyavan", "Язъяванский район", "Yozyovon tumani", "district", 250),
  ]),
  document_types: items([
    { slug: "land", name: { ru: "Право на землю", uz: "Yerga bo‘lgan huquq" }, sort: 10 },
    {
      slug: "permit",
      name: { ru: "Разрешение на строительство", uz: "Qurilish ruxsatnomasi" },
      sort: 20,
    },
    {
      slug: "declaration",
      name: { ru: "Проектная декларация", uz: "Loyiha deklaratsiyasi" },
      sort: 30,
    },
    {
      slug: "expertise",
      name: { ru: "Заключение госэкспертизы", uz: "Davlat ekspertizasi xulosasi" },
      sort: 40,
    },
    {
      slug: "seismic",
      name: { ru: "Заключение по сейсмостойкости", uz: "Seysmik bardoshlilik xulosasi" },
      sort: 50,
    },
    {
      slug: "commissioning",
      name: { ru: "Акт ввода в эксплуатацию", uz: "Foydalanishga topshirish dalolatnomasi" },
      sort: 60,
    },
  ]),
  detail_topics: items([
    { slug: "about", name: { ru: "О проекте", uz: "Loyiha haqida" }, sort: 10 },
    { slug: "quality", name: { ru: "Качество и стиль", uz: "Sifat va uslub" }, sort: 20 },
    { slug: "landscaping", name: { ru: "Благоустройство", uz: "Obodonlashtirish" }, sort: 30 },
    {
      slug: "amenities",
      name: { ru: "Функциональные помещения", uz: "Funksional xonalar" },
      sort: 40,
    },
    {
      slug: "location",
      name: { ru: "Локация и внешняя инфраструктура", uz: "Joylashuv va tashqi infratuzilma" },
      sort: 50,
    },
    {
      slug: "engineering",
      name: {
        ru: "Технологии строительства и инженерные решения",
        uz: "Qurilish texnologiyalari va muhandislik yechimlari",
      },
      sort: 60,
    },
  ]),
  finishings: items([
    { slug: "none", name: { ru: "Без отделки", uz: "Pardozsiz" }, sort: 10 },
    { slug: "rough", name: { ru: "Черновая", uz: "Qoralama" }, sort: 20 },
    { slug: "white-box", name: { ru: "White box", uz: "White box" }, sort: 30 },
    { slug: "turnkey", name: { ru: "Под ключ", uz: "Kalit tayyor" }, sort: 40 },
  ]),
  // Банков миграция не вставляет: их заводит руководитель (в DEMO — Ipoteka и Ipak Yuli).
  banks: [],
};
