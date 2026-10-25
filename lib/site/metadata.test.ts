import { describe, expect, it } from "vitest";
import { localizedPath, pageMetadata, siteOrigin } from "./metadata";

describe("siteOrigin", () => {
  it("SITE_URL → URL Netlify → боевой домен; без хвостового «/»", () => {
    expect(siteOrigin({ SITE_URL: "https://vodiyhouse.uz/", URL: "https://x.netlify.app" })).toBe(
      "https://vodiyhouse.uz",
    );
    expect(siteOrigin({ URL: "https://vodiy-test.netlify.app" })).toBe("https://vodiy-test.netlify.app");
    expect(siteOrigin({})).toBe("https://vodiyhouse.uz");
  });
});

describe("pageMetadata", () => {
  it("canonical на своём языке, пара uz / ru и x-default → uz", () => {
    const meta = pageMetadata({ locale: "ru", path: "/kalkulyator", title: "T", description: "D" });
    expect(meta.alternates).toEqual({
      canonical: "/ru/kalkulyator",
      languages: { uz: "/uz/kalkulyator", ru: "/ru/kalkulyator", "x-default": "/uz/kalkulyator" },
    });
    expect(meta.openGraph).toMatchObject({ url: "/ru/kalkulyator", locale: "ru_RU", alternateLocale: ["uz_UZ"] });
    // Своя секция openGraph затирает картинку раздела — картинка сайта стоит явно.
    expect(meta.openGraph).toMatchObject({ images: [{ url: "/ru/opengraph-image", width: 1200, height: 630 }] });
    expect(meta.robots).toBeUndefined();
  });

  it("главная — /uz и /ru без хвоста; noindex — без выдачи, ссылки ведут дальше", () => {
    expect(localizedPath("uz", "/")).toBe("/uz");
    const meta = pageMetadata({ locale: "uz", path: "/", title: "T", description: "D", noindex: true });
    expect(meta.alternates?.canonical).toBe("/uz");
    expect(meta.robots).toEqual({ index: false, follow: true });
  });
});
