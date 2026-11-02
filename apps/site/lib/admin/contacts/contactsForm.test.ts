import { describe, expect, it } from "vitest";
import { contactsFrom, formatPhone, NO_CONTACTS } from "@/lib/contacts";
import { contactsFields, normalizeHandle, normalizePhone, parseContacts } from "./contactsForm";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe("normalizePhone", () => {
  it("привычные записи — в +998XXXXXXXXX", () => {
    expect(normalizePhone("90 123 45 67")).toBe("+998901234567");
    expect(normalizePhone("998 90 123-45-67")).toBe("+998901234567");
    expect(normalizePhone("+998 (90) 123 45 67")).toBe("+998901234567");
  });

  it("чужой код и короткий номер не подгоняются", () => {
    expect(normalizePhone("+7 900 123 45 67")).toBe("+79001234567");
    expect(normalizePhone("123 45 67")).toBe("1234567");
  });
});

describe("normalizeHandle", () => {
  it("@ник, ссылка t.me и Instagram — одно имя", () => {
    expect(normalizeHandle("@vodiyhouse")).toBe("vodiyhouse");
    expect(normalizeHandle("https://t.me/vodiyhouse")).toBe("vodiyhouse");
    expect(normalizeHandle("https://www.instagram.com/vodiy.house/?hl=ru")).toBe("vodiy.house");
  });

  it("чужая ссылка и путь глубже профиля не превращаются в имя — проверка их отклонит", () => {
    const parsed = parseContacts(
      form({ instagram: "https://www.facebook.com/vodiyhouse", telegram: "m.instagram.com/vodiy" }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({ instagram: "instagram", telegram: "telegram" });
    expect(normalizeHandle("instagram.com/stories/vodiy/1")).toBe("stories/vodiy/1");
  });
});

describe("parseContacts", () => {
  it("пустая форма — все контакты пусты (кнопок на сайте нет)", () => {
    expect(parseContacts(form({}))).toEqual({ ok: true, value: NO_CONTACTS });
  });

  it("полная форма — в одной записи", () => {
    const parsed = parseContacts(
      form({
        phone: "90 123 45 67",
        telegram: "@vodiyhouse",
        bot: "t.me/VodiyHouseBot",
        instagram: "vodiy.house",
        callbackMinutes: "15",
        "hours.ru": "Пн–Сб, 9:00–19:00",
        "hours.uz": "Du–Sh, 9:00–19:00",
        "freeBadge.ru": "Для вас бесплатно",
        "freeBadge.uz": "Siz uchun bepul",
        // Пустой второй пункт пропускается: третий становится вторым.
        "freeService0.ru": "Подбор ЖК под ваш бюджет",
        "freeService0.uz": "Byudjetingizga mos TJM tanlash",
        "freeService2.ru": "Показ объекта с менеджером",
        "freeService2.uz": "Obyektni menejer bilan ko‘rish",
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        phone: "+998901234567",
        telegram: "vodiyhouse",
        bot: "VodiyHouseBot",
        instagram: "vodiy.house",
        callbackMinutes: 15,
        hours: { ru: "Пн–Сб, 9:00–19:00", uz: "Du–Sh, 9:00–19:00" },
        freeBadge: { ru: "Для вас бесплатно", uz: "Siz uchun bepul" },
        freeServices: [
          { ru: "Подбор ЖК под ваш бюджет", uz: "Byudjetingizga mos TJM tanlash" },
          { ru: "Показ объекта с менеджером", uz: "Obyektni menejer bilan ko‘rish" },
        ],
      },
    });
  });

  it("пункт плашки на одном языке — ошибка у этого пункта", () => {
    const parsed = parseContacts(form({ "freeService1.ru": "Только по-русски" }));
    expect(parsed).toMatchObject({ ok: false, fieldErrors: { freeService1: "missingUz" } });
  });

  it("неверные поля — ошибки у полей, набранное возвращается как есть", () => {
    const parsed = parseContacts(
      form({
        phone: "+7 900 123 45 67",
        telegram: "ab",
        bot: "vodiyhouse",
        instagram: "..x",
        callbackMinutes: "0",
        "hours.ru": "Пн–Сб",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({
      phone: "phone",
      telegram: "telegram",
      bot: "bot",
      instagram: "instagram",
      callbackMinutes: "minutes",
      hours: "missingUz",
    });
    expect(parsed.fields.phone).toBe("+7 900 123 45 67");
    expect(parsed.fields.callbackMinutes).toBe("0");
  });
});

describe("contactsFrom", () => {
  it("кривое значение базы — пусто, а не на сайт", () => {
    expect(contactsFrom({ phone: "12345", telegram: "a b", callbackMinutes: 2.5, hours: { ru: "x" } })).toEqual(
      NO_CONTACTS,
    );
    expect(contactsFrom(null)).toEqual(NO_CONTACTS);
  });

  it("сохранённое → снова в поля формы", () => {
    const contacts = { ...NO_CONTACTS, phone: "+998901234567", callbackMinutes: 10 };
    expect(contactsFrom(contacts)).toEqual(contacts);
    expect(contactsFields(contacts)).toMatchObject({ phone: "+998901234567", callbackMinutes: "10", bot: "" });
  });
});

describe("formatPhone", () => {
  it("+998901234567 → «+998 90 123 45 67»", () => {
    expect(formatPhone("+998901234567")).toBe("+998 90 123 45 67");
  });
});
