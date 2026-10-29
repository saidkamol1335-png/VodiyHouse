import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { progressReminderText } from "./reminder";

describe("напоминание о ходе строительства (5D.3)", () => {
  it("число ЖК, строка на ЖК — дата последнего отчёта или «отчётов ещё нет», ссылка в кабинет", () => {
    const text = progressReminderText(
      [
        { id: "a", name: "Namuna", last_published_at: "2026-08-02T07:00:00.123456+00:00" },
        { id: "b", name: "Orzu", last_published_at: null },
      ],
      "https://vodiyhouse.uz/admin/video",
      formatDate,
    );
    expect(text.split("\n")).toEqual([
      "Ход строительства: у 2 ЖК последний отчёт старше 45 дней — устаревший ход строительства вредит доверию.",
      "• Namuna — последний 02.08.2026",
      "• Orzu — отчётов ещё нет",
      "Отчёты по ЖК: https://vodiyhouse.uz/admin/video",
    ]);
  });
});
