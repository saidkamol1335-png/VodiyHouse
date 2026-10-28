import { describe, expect, it } from "vitest";
import { parseLeadRequest } from "./request";

// Заявка из браузера: правила полей ТЗ 10.2 и чистка всего лишнего до базы.

const base = { type: "callback", name: " Азиз ", phone: "90 123 45 67", siteLang: "ru", object: {}, pageUrl: "/ru", source: {} };

describe("parseLeadRequest", () => {
  it("телефон к +998XXXXXXXXX, имя без пробелов по краям, язык сайта", () => {
    const parsed = parseLeadRequest(base);
    expect(parsed).toMatchObject({ ok: true, trap: false, lead: { name: "Азиз", phone: "+998901234567", site_lang: "ru" } });
  });

  it("пустое имя и короткий номер — ошибки полей, как у формы", () => {
    expect(parseLeadRequest({ ...base, name: " ", phone: "90 123" })).toEqual({
      ok: false,
      fields: { name: "required", phone: "phone" },
    });
    expect(parseLeadRequest({ ...base, phone: "" })).toEqual({ ok: false, fields: { phone: "required" } });
    // Нетронутое «+998 » из маски — «Заполните», а не «номер в формате…».
    expect(parseLeadRequest({ ...base, phone: "+998 " })).toEqual({ ok: false, fields: { phone: "required" } });
    expect(parseLeadRequest({ ...base, type: "partner", partner: { company: "" } })).toEqual({
      ok: false,
      fields: { company: "required" },
    });
  });

  it("застройщик: комментарий сохраняет строки, лишние пробелы и пустые строки — убираются", () => {
    const parsed = parseLeadRequest({
      ...base,
      type: "partner",
      partner: { company: " ООО  Строй ", city: "Фергана", format: "", projects: "", comment: "ЖК Shodlik —  120 кв.\r\n\n\n\nВопрос   по рекламе  " },
    });
    expect(parsed).toMatchObject({
      ok: true,
      lead: { payload: { partner: { company: "ООО Строй", comment: "ЖК Shodlik — 120 кв.\n\nВопрос по рекламе" } } },
    });
  });

  it("чужой тип — отказ; объект — только slug и uuid; страница — только путь сайта", () => {
    expect(parseLeadRequest({ ...base, type: "complaint" }).ok).toBe(false);
    const parsed = parseLeadRequest({
      ...base,
      object: { complex: "demo-shodlik", layout: "не-uuid", unit: "'; drop" },
      pageUrl: "https://evil.example/ru",
    });
    expect(parsed.ok && parsed.lead).toMatchObject({ complex: "demo-shodlik", layout: undefined, unit: undefined, page_url: null });
  });

  it("источник — только метки ТЗ 10.3, обрезаны; лишние ключи не сохраняются", () => {
    const parsed = parseLeadRequest({
      ...base,
      source: { utm_source: "instagram", utm_content: "x".repeat(500), token: "секрет" },
    });
    expect(parsed.ok && parsed.lead.source).toEqual({ utm_source: "instagram", utm_content: "x".repeat(200) });
  });

  it("просмотр: что, день и время; неизвестное время — без времени; без выбора — «этот ЖК, завтра»", () => {
    const view = parseLeadRequest({ ...base, type: "view", view: { target: "office", day: "weekend", time: "night" } });
    expect(view.ok && view.lead.payload).toEqual({ view: { target: "office", day: "weekend", time: null } });
    const empty = parseLeadRequest({ ...base, type: "view" });
    expect(empty.ok && empty.lead.payload).toEqual({ view: { target: "complex", day: "tomorrow", time: null } });
  });

  it("расчёт: снимок только с программой-uuid; у других типов снимка нет", () => {
    const program = "4f1b2c3d-1111-4222-8333-944455556666";
    const calc = { program, input: { price: 1 }, result: { monthly: 2 } };
    const own = parseLeadRequest({ ...base, type: "calc", calc, calcRows: [{ label: "Платёж", value: "$1" }] });
    expect(own.ok && own.lead).toMatchObject({ calc, payload: { rows: [{ label: "Платёж", value: "$1" }] } });
    const other = parseLeadRequest({ ...base, calc });
    expect(other.ok && other.lead.calc).toBeUndefined();
  });

  it("заполненная ловушка — отмечена: сервер ответит «отправлено», но не сохранит", () => {
    const parsed = parseLeadRequest({ ...base, trap: "http://spam" });
    expect(parsed.ok && parsed.trap).toBe(true);
  });
});
