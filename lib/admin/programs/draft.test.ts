import { describe, expect, it } from "vitest";
import { DEMO_PROGRAMS_SCREEN } from "./demo";
import { draftFromItem, draftNumber, newDraft, recordFromDraft, typeAndMethod } from "./draft";
import { kindOf, panelUpdatedAt, programItemFrom, rateSettingFrom } from "./panels";
import { effectiveRate, PROGRAM_KINDS } from "./types";

// Черновик редактора и превью карточки (2.4, В1): превью показывает программу так, как её покажет
// сохранённая запись.

const items = DEMO_PROGRAMS_SCREEN.panels.flatMap((panel) => panel.programs);
const base = {
  is_active: false,
  sort: 990,
  created_at: "2026-10-24T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
};

describe("превью черновика", () => {
  it.each(items.map((item) => [item.record.id, item] as const))(
    "DEMO %s: «Изменить» без правок — та же программа в превью",
    (_, item) => {
      const record = recordFromDraft(draftFromItem(item), base, item.bankName);
      expect(programItemFrom(record).program).toEqual(item.program);
    },
  );

  it("пустая новая строка не становится чипом «0 мес.»", () => {
    const bank = recordFromDraft(newDraft("bank", "d1"), base, null);
    const scheme = recordFromDraft(newDraft("scheme", "d1"), base, null);
    expect(bank.terms).toEqual([]);
    expect(scheme.tiers).toEqual([]);
  });

  it("набранное число: пробелы и запятая; пусто и буквы — null", () => {
    expect(draftNumber(" 1 500,5 ")).toBe(1500.5);
    expect(draftNumber("0")).toBe(0);
    expect(draftNumber("")).toBeNull();
    expect(draftNumber("3o")).toBeNull();
  });
});

describe("вид программы ↔ тип и метод базы", () => {
  it.each(PROGRAM_KINDS)("%s: вид → запись → тот же вид", (kind) => {
    expect(kindOf(typeAndMethod(newDraft(kind, "d1")))).toBe(kind);
  });

  it("банк: аннуитет или дифференцированный — из черновика", () => {
    const draft = { ...newDraft("mortgage", "d1"), bankMethod: "differentiated" as const };
    expect(typeAndMethod(draft)).toEqual({ type: "mortgage", method: "differentiated" });
  });
});

describe("панель и курс", () => {
  it("«обновлено»: позднее из правки программ и отметки «проверены»", () => {
    const panel = DEMO_PROGRAMS_SCREEN.panels[0]!;
    expect(panelUpdatedAt(panel)).toBe("2026-10-01T09:00:00+00:00");
    expect(panelUpdatedAt({ ...panel, checkedAt: "2026-10-20T08:00:00+00:00" })).toBe(
      "2026-10-20T08:00:00+00:00",
    );
    expect(panelUpdatedAt({ checkedAt: null, programs: [] })).toBeNull();
  });

  it("курс из settings: ручной сильнее ЦБ; мусор — курса нет", () => {
    const setting = rateSettingFrom({
      cbu: { usd_uzs: 11808.76, date: "2026-10-01" },
      manual: { usd_uzs: "12650.5", date: "2026-10-24" },
      demo: true,
    });
    expect(effectiveRate(setting)).toEqual({
      usdUzs: 12650.5,
      date: "2026-10-24",
      source: "manual",
    });
    expect(effectiveRate({ ...setting, manual: null })).toMatchObject({ source: "cbu" });
    expect(rateSettingFrom({ cbu: { usd_uzs: 0, date: "x" }, manual: "12000" })).toEqual({
      cbu: null,
      manual: null,
    });
    expect(effectiveRate(rateSettingFrom(null))).toBeNull();
  });
});
