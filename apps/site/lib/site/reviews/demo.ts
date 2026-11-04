import type { SiteReview } from "./model";

// DEMO-отзывы — только для разработки и e2e (VH_DEMO_SECTIONS=1, не в сборке для сайта): помечены
// «DEMO», фото — иллюстративные рендеры первого экрана. Настоящих отзывов нет (TODO-заказчик).

const photo = (slug: string) => ({
  src: `/hero/renders/v1/${slug}-736.webp`,
  width: 736,
  height: 1104,
  blur: null,
});

export const DEMO_REVIEWS: SiteReview[] = [
  {
    id: "demo-review-1",
    name: "DEMO · Покупатель 1",
    role: { ru: "DEMO: купил 2-комн. квартиру", uz: "DEMO: 2 xonali xonadon oldi" },
    rating: 5,
    quote: {
      ru: "DEMO. Подобрали квартиру за неделю, документы проверили до задатка, ключи выдали в срок.",
      uz: "DEMO. Bir haftada xonadon tanlab berishdi, hujjatlarni oldindan tekshirishdi, kalitni vaqtida berishdi.",
    },
    accent: { ru: "документы проверили до задатка", uz: "hujjatlarni oldindan tekshirishdi" },
    photo: photo("bronze-tower-sunset"),
    youtubeId: null,
    complex: null,
  },
  {
    id: "demo-review-2",
    name: "DEMO · Покупатель 2",
    role: { ru: "DEMO: купила 1-комн. для сдачи", uz: "DEMO: ijaraga 1 xonali oldi" },
    rating: 4.5,
    quote: {
      ru: "DEMO. Сравнили три ЖК по цене за метр и рассрочке — выбрала спокойно, без давления.",
      uz: "DEMO. Uchta TJMni metr narxi va muddatli to‘lov bo‘yicha solishtirdik — bosimsiz tanladim.",
    },
    accent: { ru: "без давления", uz: "bosimsiz tanladim" },
    photo: photo("garden-fountain"),
    youtubeId: null,
    complex: null,
  },
  {
    id: "demo-review-3",
    name: "DEMO · Семья 3",
    role: {
      ru: "DEMO: купили 3-комн. в рассрочку",
      uz: "DEMO: 3 xonalini muddatli to‘lovga olishdi",
    },
    rating: 5,
    quote: {
      ru: "DEMO. Помогли с рассрочкой у застройщика и объяснили каждый платёж до подписания.",
      uz: "DEMO. Quruvchidan muddatli to‘lovni rasmiylashtirishga yordam berishdi va har bir to‘lovni tushuntirishdi.",
    },
    accent: { ru: "объяснили каждый платёж", uz: "har bir to‘lovni tushuntirishdi" },
    photo: photo("courtyard-pool"),
    youtubeId: null,
    complex: null,
  },
  {
    id: "demo-review-4",
    name: "DEMO · Покупатель 4",
    role: { ru: "DEMO: купил 2-комн. в сданном доме", uz: "DEMO: topshirilgan uyda 2 xonali oldi" },
    rating: 4,
    quote: {
      ru: "DEMO. Показали квартиры в сданных домах в один день и честно сказали про минусы.",
      uz: "DEMO. Topshirilgan uylardagi xonadonlarni bir kunda ko‘rsatishdi va kamchiliklarini ham aytishdi.",
    },
    accent: { ru: "честно сказали про минусы", uz: "kamchiliklarini ham aytishdi" },
    photo: null,
    youtubeId: null,
    complex: null,
  },
];
