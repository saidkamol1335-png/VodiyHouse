import { describe, expect, it } from "vitest";
import { formatPrice } from "@/lib/format";
import { describeFilter, type FilterLabels } from "./describe";
import { NO_FILTER } from "./filter";
import type { SiteCatalog } from "./records";

// Фильтр словами для заявки «Подбор»: подписи — от вызывающего, названия — из каталога.

const labels: FilterLabels = {
  rooms: "Комнаты",
  studio: "Студия",
  price: "Цена квартиры, $",
  priceFrom: "от",
  priceTo: "до",
  location: "Город и район",
  payment: "Способ оплаты",
  payments: { full: "100% оплата", inst: "Рассрочка", bank: "Через банк", mort: "Ипотека" },
  deadline: "Срок сдачи",
  deadlineBuilt: "Сдан",
  deadlineUpTo: (year) => `до ${year}`,
  developer: "Застройщик",
  finishing: "Отделка",
};
const catalog = {
  rate: null,
  developers: [{ slug: "demo-sifat", name: "Sifat Qurilish" }],
  complexes: [
    {
      location: { slug: "kirguli", name: { ru: "Киргули", uz: "Qirg‘uli" } },
      blocks: [{ finishing: { slug: "korobka", name: { ru: "Коробка", uz: "Qora suvoq" } } }],
    },
  ],
} as unknown as SiteCatalog;

describe("describeFilter", () => {
  it("пустой фильтр — пустая строка", () => {
    expect(describeFilter(NO_FILTER, catalog, labels, "ru")).toBe("");
  });

  it("комнаты, цена, район, оплата, срок, застройщик и отделка — словами через «·», чужой slug как есть", () => {
    const text = describeFilter(
      {
        ...NO_FILTER,
        rooms: [0, 2, 4],
        priceMin: 40_000,
        priceMax: 60_000,
        locations: ["kirguli"],
        payments: ["inst", "mort"],
        deadline: 2027,
        developers: ["demo-sifat"],
        finishings: ["korobka", "unknown"],
      },
      catalog,
      labels,
      "ru",
    );
    expect(text).toBe(
      [
        "Комнаты: Студия, 2, 4+",
        `Цена квартиры, $: от ${formatPrice(40_000, "USD")} до ${formatPrice(60_000, "USD")}`,
        "Город и район: Киргули",
        "Способ оплаты: Рассрочка, Ипотека",
        "Срок сдачи: до 2027",
        "Застройщик: Sifat Qurilish",
        "Отделка: Коробка, unknown",
      ].join(" · "),
    );
  });

  it("«Сдан» и по-узбекски — названия на языке страницы", () => {
    const text = describeFilter({ ...NO_FILTER, deadline: "built", locations: ["kirguli"] }, catalog, labels, "uz");
    expect(text).toBe("Город и район: Qirg‘uli · Срок сдачи: Сдан");
  });
});
