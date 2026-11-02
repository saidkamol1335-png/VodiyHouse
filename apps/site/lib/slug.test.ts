import { describe, expect, it } from "vitest";
import { contentSlug, SLUG_MAX_LENGTH, slugify } from "./slug";

// Тот же шаблон, что check slug в миграциях.
const DB_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe("адрес на сайте из названия", () => {
  it("узбекская латиница: апострофы убираются, пробелы — дефисы", () => {
    expect(slugify("Farg‘ona Sifat Qurilish")).toBe("fargona-sifat-qurilish");
    expect(slugify("Marg'ilon  Invest")).toBe("margilon-invest");
    expect(slugify("O‘zbekiston ʻYangi Uyʼ")).toBe("ozbekiston-yangi-uy");
  });

  it("кириллица — по узбекской латинице, включая ў қ ғ ҳ", () => {
    expect(slugify("Фарғона Сифат Қурилиш")).toBe("fargona-sifat-qurilish");
    expect(slugify("Ўзбекистон Ҳамкор")).toBe("ozbekiston-hamkor");
    expect(slugify("Строй Щит №1")).toBe("stroy-shit-no1");
    expect(slugify("Объект «Шодлик»")).toBe("obekt-shodlik");
  });

  it("диакритика и знаки — без следа; результат проходит check базы", () => {
    expect(slugify("Café — Résidence & Co.")).toBe("cafe-residence-co");
    for (const name of ["Farg‘ona Sifat Qurilish", "Фарғона", "A1", "ЖК «Юлдуз» 2-я очередь"]) {
      expect(slugify(name)).toMatch(DB_SLUG);
    }
  });

  it("длинное название обрезается по границе слова", () => {
    const slug = slugify("Qurilish ".repeat(10));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug).toMatch(DB_SLUG);
    expect(slug.endsWith("qurilish")).toBe(true);
  });

  it("пусто — запасной адрес; похожее на DEMO — с префиксом", () => {
    expect(slugify("— !!! —")).toBe("");
    expect(contentSlug("— !!! —", "zastroyshchik")).toBe("zastroyshchik");
    expect(contentSlug("Demo Qurilish", "zastroyshchik")).toBe("z-demo-qurilish");
    expect(contentSlug("Demo", "zastroyshchik")).toBe("z-demo");
    expect(contentSlug("Demokrat Qurilish", "zastroyshchik")).toBe("demokrat-qurilish");
  });
});
