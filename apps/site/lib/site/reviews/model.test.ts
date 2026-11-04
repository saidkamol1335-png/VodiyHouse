import { describe, expect, it } from "vitest";
import { DEMO_REVIEWS } from "./demo";
import { quoteWords, reviewStats, starsOf, visibleReviews } from "./model";

describe("отзывы — правила блока", () => {
  it("меньше трёх — блока нет; три и больше — все", () => {
    expect(visibleReviews(DEMO_REVIEWS.slice(0, 2))).toEqual([]);
    expect(visibleReviews(DEMO_REVIEWS.slice(0, 3))).toHaveLength(3);
  });

  it("число и средняя — из этих же отзывов, до десятых", () => {
    expect(reviewStats(DEMO_REVIEWS)).toEqual({ count: 4, average: 4.6 });
    expect(reviewStats([])).toEqual({ count: 0, average: 0 });
  });

  it("звёзды с половинками", () => {
    expect(starsOf(4.5)).toEqual(["full", "full", "full", "full", "half"]);
    expect(starsOf(3)).toEqual(["full", "full", "full", "empty", "empty"]);
    expect(starsOf(4.3)).toEqual(["full", "full", "full", "full", "half"]);
  });

  it("цитата по словам: выделенная фраза — accent", () => {
    expect(quoteWords("Ключи выдали вовремя, спасибо", "вовремя,")).toEqual([
      { text: "Ключи", accent: false },
      { text: "выдали", accent: false },
      { text: "вовремя,", accent: true },
      { text: "спасибо", accent: false },
    ]);
    expect(quoteWords("Всё хорошо", "нет такого").every((word) => !word.accent)).toBe(true);
    // Фраза без точки, точка — при слове: «давления.» одним словом и выделено.
    expect(quoteWords("Выбрала без давления.", "без давления")).toEqual([
      { text: "Выбрала", accent: false },
      { text: "без", accent: true },
      { text: "давления.", accent: true },
    ]);
  });

  it("DEMO помечены «DEMO» — не путать с настоящими", () => {
    for (const review of DEMO_REVIEWS) {
      expect(review.name).toMatch(/^DEMO/);
      expect(review.quote.ru).toMatch(/^DEMO/);
    }
  });
});
