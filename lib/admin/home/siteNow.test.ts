import { describe, expect, it } from "vitest";
import { filterDetail, siteNowFrom } from "./siteNow";

// «Сейчас на сайте» (3.12, ревью блока F): фильтр в ленте — из параметров каталога в адресе события,
// чужой текст из браузера не показывается.

describe("лента «Сейчас на сайте»", () => {
  it("фильтр — только понятные каталогу параметры адреса", () => {
    expect(filterDetail("/ru/novostroyki?komnat=2&utm_source=ig&x=Звоните+998901234567")).toBe("komnat 2");
    expect(filterDetail("/ru/novostroyki?x=1")).toBeNull();
    expect(filterDetail(null)).toBeNull();
  });

  it("подпись фильтра собирается из адреса, а не из присланного текста", () => {
    const now = siteNowFrom({
      online: 2,
      feed: [{ at: "2026-10-25T10:00:00Z", type: "filter", detail: "Срочно перезвоните", path: "/uz/novostroyki?komnat=1,2", source: null, device: "mobile", complex: null }],
    });
    expect(now.online).toBe(2);
    expect(now.feed[0]!.detail).toBe("komnat 1,2");
  });
});
