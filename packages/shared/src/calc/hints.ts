import type { BilingualRecord } from "./records";
import { bilingualRecord } from "./stockRecords";

// Подсказки «?» калькулятора (ТЗ 4.4, решение фазы 2): набор задаёт код — какие термины и где;
// тексты — справочник hints (правит руководитель в «Справочниках»). Здесь — черновики Vodiy House
// для миграции 20261024130000_calc_hints.sql и стендов: TODO-заказчик — утвердить формулировки.

export const CALC_HINT_SLUGS = [
  "down-payment",
  "installment",
  "installment-markup",
  "bank-installment",
  "mortgage",
  "markup",
  "bank-interest",
  "appraisal",
  "commission",
  "insurance",
  "overpayment",
] as const;
export type CalcHintSlug = (typeof CALC_HINT_SLUGS)[number];

export type CalcHint = { term: BilingualRecord; text: BilingualRecord };
/** Тексты подсказок по slug; нет текста (выключили в справочнике) — нет и «?». */
export type CalcHints = Partial<Record<CalcHintSlug, CalcHint>>;

export const CALC_HINT_DRAFTS: Readonly<Record<CalcHintSlug, CalcHint>> = {
  "down-payment": {
    term: { ru: "Первоначальный взнос", uz: "Boshlang‘ich to‘lov" },
    text: {
      ru: "Сумма, которую вы платите сразу при покупке. Чем больше взнос, тем меньше остаток и платёж в месяц.",
      uz: "Xarid paytida darhol to‘lanadigan summa. To‘lov qancha katta bo‘lsa, qoldiq va oylik to‘lov shuncha kam.",
    },
  },
  installment: {
    term: { ru: "Рассрочка от застройщика", uz: "Quruvchidan muddatli to‘lov" },
    text: {
      ru: "Вы платите за квартиру частями прямо застройщику, без банка и без процентов.",
      uz: "Kvartira uchun to‘g‘ridan-to‘g‘ri quruvchiga, bankisiz va foizsiz, bo‘lib to‘laysiz.",
    },
  },
  "installment-markup": {
    term: { ru: "Рассрочка с наценкой", uz: "Ustama bilan muddatli to‘lov" },
    text: {
      ru: "Вы платите застройщику частями, без банка; за срок к цене добавляется наценка.",
      uz: "Quruvchiga bankisiz bo‘lib to‘laysiz; muddat uchun narxga ustama qo‘shiladi.",
    },
  },
  "bank-installment": {
    term: { ru: "Рассрочка через банк", uz: "Bank orqali muddatli to‘lov" },
    text: {
      ru: "Банк оплачивает остаток застройщику, а вы возвращаете его банку частями с процентами за 1–2 года.",
      uz: "Qoldiqni bank quruvchiga to‘laydi, siz uni bankka foizi bilan 1–2 yilda bo‘lib qaytarasiz.",
    },
  },
  mortgage: {
    term: { ru: "Ипотека", uz: "Ipoteka" },
    text: {
      ru: "Кредит банка на жильё на много лет под залог квартиры. Платёж в месяц меньше, но проценты за весь срок больше.",
      uz: "Kvartira garovi ostida ko‘p yilga beriladigan bank krediti. Oylik to‘lov kamroq, lekin butun muddat foizlari ko‘proq.",
    },
  },
  markup: {
    term: { ru: "Наценка", uz: "Ustama" },
    text: {
      ru: "Надбавка к цене за оплату частями. Её делят на месяцы вместе с остатком.",
      uz: "Bo‘lib to‘lash uchun narxga qo‘shimcha. U qoldiq bilan birga oylarga bo‘linadi.",
    },
  },
  "bank-interest": {
    term: { ru: "Проценты банка", uz: "Bank foizlari" },
    text: {
      ru: "Плата банку за кредит: процент годовых с оставшегося долга. Здесь — сумма за весь срок.",
      uz: "Kredit uchun bankka to‘lov: qolgan qarzdan yillik foiz. Bu yerda — butun muddat uchun jami.",
    },
  },
  appraisal: {
    term: { ru: "Оценка квартиры", uz: "Kvartirani baholash" },
    text: {
      ru: "Отчёт оценщика о стоимости квартиры — банк требует его до выдачи кредита. Платится один раз.",
      uz: "Kvartira qiymati bo‘yicha baholovchi hisoboti — bank kreditdan oldin talab qiladi. Bir marta to‘lanadi.",
    },
  },
  commission: {
    term: { ru: "Комиссия банка", uz: "Bank komissiyasi" },
    text: {
      ru: "Разовая плата банку за выдачу кредита — процент от суммы кредита.",
      uz: "Kredit berganlik uchun bankka bir martalik to‘lov — kredit summasidan foiz.",
    },
  },
  insurance: {
    term: { ru: "Страхование", uz: "Sug‘urta" },
    text: {
      ru: "Страховка квартиры или жизни, которую банк требует на время кредита.",
      uz: "Kredit muddatida bank talab qiladigan kvartira yoki hayot sug‘urtasi.",
    },
  },
  overpayment: {
    term: { ru: "Переплата", uz: "Ortiqcha to‘lov" },
    text: {
      ru: "Сколько вы заплатите сверх цены квартиры: проценты, наценка и разовые платежи банка.",
      uz: "Kvartira narxidan ortiq to‘laydiganingiz: foizlar, ustama va bankning bir martalik to‘lovlari.",
    },
  },
};

type HintRecord = { slug: string; term: unknown; text: unknown };

const isCalcHint = (slug: string): slug is CalcHintSlug =>
  (CALC_HINT_SLUGS as readonly string[]).includes(slug);

/** Строки справочника hints (включённые) → подсказки калькулятора; чужие slug — мимо. */
export function calcHintsFrom(records: readonly HintRecord[]): CalcHints {
  const hints: CalcHints = {};
  for (const record of records) {
    if (isCalcHint(record.slug)) {
      hints[record.slug] = {
        term: bilingualRecord(record.term),
        text: bilingualRecord(record.text),
      };
    }
  }
  return hints;
}
