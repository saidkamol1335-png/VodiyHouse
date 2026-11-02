import { describe, expect, it } from "vitest";
import { adminOrigin } from "./origin";

describe("адрес кабинета для ссылок", () => {
  it("ADMIN_URL главнее адреса Netlify; без обоих — боевой домен; без хвостового «/»", () => {
    expect(adminOrigin({ ADMIN_URL: "https://admin.vodiyhouse.uz/", URL: "https://x.netlify.app" })).toBe("https://admin.vodiyhouse.uz");
    expect(adminOrigin({ ADMIN_URL: "", URL: "https://vh-admin.netlify.app" })).toBe("https://vh-admin.netlify.app");
    expect(adminOrigin({})).toBe("https://admin.vodiyhouse.uz");
  });
});
