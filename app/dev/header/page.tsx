import { notFound } from "next/navigation";
import { DevHeaderStage } from "@/components/DevHeaderStage";
import { SiteContactsProvider } from "@/components/SiteContacts";
import type { SiteContacts } from "@/lib/contacts";

// DEMO: контакты для проверки шапки и меню с введёнными «Настройки → Контакты» (Ф9). Настоящих
// контактов Vodiy House ещё нет (TODO-заказчик) — на сайте до них кнопок нет.
const DEMO_CONTACTS: SiteContacts = {
  phone: "+998900000000",
  telegram: "vodiyhouse_demo",
  bot: "VodiyHouseDemoBot",
  instagram: "vodiyhouse.demo",
  hours: { ru: "Пн–Сб, 9:00–19:00 (DEMO)", uz: "Du–Sh, 9:00–19:00 (DEMO)" },
  callbackMinutes: 15,
  freeBadge: null,
};

// Проверка шапки поверх фото (решение Ш6) и контактов в ней. В продакшене страницы нет.
export default function DevHeaderPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <SiteContactsProvider contacts={DEMO_CONTACTS}>
      <DevHeaderStage />
    </SiteContactsProvider>
  );
}
