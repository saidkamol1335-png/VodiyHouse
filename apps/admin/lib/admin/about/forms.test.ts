import { describe, expect, it } from "vitest";
import { aboutField, parseHistory, parseTeam } from "./forms";

const form = (pairs: [string, string][]) => {
  const data = new FormData();
  for (const [key, value] of pairs) data.append(key, value);
  return data;
};

describe("«О компании» — разбор форм (правки 15.11, п. 25)", () => {
  const event = (key: string, year: string, ru: string, uz: string): [string, string][] => [
    ["historyKey", key],
    [aboutField(key, "year"), year],
    [`${aboutField(key, "title")}.ru`, ru],
    [`${aboutField(key, "title")}.uz`, uz],
    [`${aboutField(key, "text")}.ru`, ""],
    [`${aboutField(key, "text")}.uz`, ""],
  ];

  it("история: по году, пустая строка пропущена, кривой год — ошибка", () => {
    expect(parseHistory(form([...event("a", "2024", "Пятый ЖК", "Beshinchi TJM"), ...event("b", "2019", "Офис", "Ofis"), ...event("c", "", "", "")]))).toEqual({
      ok: true,
      payload: [
        { year: 2019, title: { ru: "Офис", uz: "Ofis" }, text: null },
        { year: 2024, title: { ru: "Пятый ЖК", uz: "Beshinchi TJM" }, text: null },
      ],
    });
    expect(parseHistory(form(event("a", "19", "Офис", "Ofis")))).toEqual({ ok: false, error: null, errors: { a: { year: "year" } } });
  });

  const MEMBER = "00000000-0000-4000-8000-000000000123";
  const person = (key: string, consent: boolean, consentAt = ""): [string, string][] => [
    ["teamKey", key],
    [aboutField(key, "id"), MEMBER],
    [aboutField(key, "name"), "Азиз Каримов"],
    [`${aboutField(key, "position")}.ru`, "Менеджер"],
    [`${aboutField(key, "position")}.uz`, "Menejer"],
    [aboutField(key, "photo"), ""],
    [aboutField(key, "consentAt"), consentAt],
    ...(consent ? ([[aboutField(key, "consent"), "on"]] as [string, string][]) : []),
  ];

  it("команда: без согласия — ошибка; новая отметка — сейчас, прежняя — сохраняется", () => {
    expect(parseTeam(form(person("a", false)))).toEqual({ ok: false, error: null, errors: { a: { consent: "consent" } } });
    const now = new Date("2026-11-17T10:00:00Z");
    expect(parseTeam(form(person("a", true)), now)).toEqual({
      ok: true,
      payload: [{ id: MEMBER, name: "Азиз Каримов", position: { ru: "Менеджер", uz: "Menejer" }, photo: null, consent_at: now.toISOString() }],
    });
    const kept = parseTeam(form(person("a", true, "2026-11-01T09:00:00Z")), now);
    expect(kept.ok && kept.payload[0]?.consent_at).toBe("2026-11-01T09:00:00Z");
  });
});
