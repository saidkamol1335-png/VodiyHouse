import { expect, test } from "@playwright/test";

// Каркас фазы A: кабинет живёт отдельно, закрыт от поиска и фреймов (PLAN §10).
test("корень ведёт на вход, экран входа на русском", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/vhod$/);
  await expect(page.getByRole("heading", { name: "Вход для сотрудников" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("заголовки: noindex, запрет фреймов, CSP", async ({ request }) => {
  const response = await request.get("/vhod");
  const headers = response.headers();
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("robots.txt закрывает весь кабинет", async ({ request }) => {
  const body = await (await request.get("/robots.txt")).text();
  expect(body).toMatch(/Disallow: \/\s*$/m);
});
