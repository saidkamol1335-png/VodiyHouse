// Сайт рядом с кабинетом (PLAN §10): спеки «кабинет поменял — сайт показал» открывают страницы
// сайта по его адресу, а не по baseURL кабинета. Адрес ставит playwright.config.ts.
export const SITE_URL = process.env.E2E_SITE_URL ?? "http://localhost:3002";

export const site = (path: string) => `${SITE_URL}${path}`;
