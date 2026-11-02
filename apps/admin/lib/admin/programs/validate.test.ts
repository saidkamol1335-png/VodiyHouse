import { describe, expect, it } from "vitest";
import { DEMO_PROGRAMS_SCREEN } from "./demo";
import { draftFromItem, emptyFee, newDraft, type ProgramDraft } from "./draft";
import { validateDraft } from "./validate";

// Проверка черновика до базы (2.4): те же правила, что у private.payment_program_problem.

const items = DEMO_PROGRAMS_SCREEN.panels.flatMap((panel) => panel.programs);
const itemOf = (kind: string) => items.find((item) => item.kind === kind)!;
const errorsOf = (draft: ProgramDraft) => {
  const result = validateDraft(draft);
  return result.ok ? {} : result.errors;
};

describe("черновик программы → запись базы", () => {
  // «Изменить» и «Сохранить» без правок не должны менять условия ни одной программы мокапа.
  it.each(items.map((item) => [item.record.id, item] as const))(
    "DEMO %s: без правок — та же запись",
    (_, item) => {
      const result = validateDraft(draftFromItem(item));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const { record } = item;
      expect(result.payload).toEqual({
        id: record.id,
        developer_id: record.developer_id,
        bank_id: record.bank_id,
        type: record.type,
        method: record.method,
        discount_pct: record.discount_pct,
        min_down_pct: record.min_down_pct,
        tiers: record.tiers,
        terms: record.terms,
        fees: record.fees,
        preset_months: record.preset_months,
        allow_custom_months: record.allow_custom_months,
        over_max_behavior: record.over_max_behavior,
        currency: record.currency,
        blocks_scope: record.blocks_scope,
        block_ids: record.block_ids,
        conditions: record.conditions,
      });
    },
  );

  it("новая программа: пустые поля — «Заполните» под каждым, банк обязателен", () => {
    expect(errorsOf(newDraft("bank", "d1"))).toEqual({
      bank: "required",
      minDownPct: "required",
      "terms.0.months": "required",
      "terms.0.ratePct": "required",
    });
    expect(errorsOf(newDraft("scheme", "d1"))).toEqual({
      "tiers.0.minDownPct": "required",
      "tiers.0.maxMonths": "required",
    });
    expect(errorsOf({ ...newDraft("scheme", "d1"), tiers: [] })).toMatchObject({
      tiers: "required",
    });
  });
});

describe("правила полей", () => {
  const scheme = draftFromItem(itemOf("scheme"));
  const bank = draftFromItem(itemOf("bank"));
  const markup = { ...newDraft("markup", "d1"), minDownPct: "20" };
  const term = { key: "t", months: "24", ratePct: "12" };

  it("ступени: взнос по возрастанию и целый, срок «до» не меньше «от», скидка до 50", () => {
    const [first, second] = scheme.tiers;
    const tiers = [
      { ...first!, minDownPct: "50", discountPct: "51" },
      { ...second!, minDownPct: "50", minMonths: "24", maxMonths: "18" },
      { ...second!, key: "x", minDownPct: "70,5" },
    ];
    expect(errorsOf({ ...scheme, tiers })).toEqual({
      "tiers.0.discountPct": "range",
      "tiers.1.minDownPct": "order",
      "tiers.1.maxMonths": "belowMin",
      "tiers.2.minDownPct": "integer",
    });
  });

  it("сроки по возрастанию, 1–600 мес.; ставка до 100 %, «17,5» — число", () => {
    const terms = [
      { key: "a", months: "24", ratePct: "17,5" },
      { key: "b", months: "12", ratePct: "101" },
      { key: "c", months: "601", ratePct: "1" },
      { key: "d", months: "1.5", ratePct: "x" },
    ];
    expect(errorsOf({ ...bank, terms })).toEqual({
      "terms.1.months": "order",
      "terms.1.ratePct": "range",
      "terms.2.months": "range",
      "terms.3.months": "number",
      "terms.3.ratePct": "number",
    });
  });

  it("разовые: без повторов и нулей; сумма — целыми, у наценки — только %", () => {
    const fees = [
      { ...emptyFee("fixed"), name: "appraisal" as const, value: "1 500 000" },
      { ...emptyFee("pct"), name: "appraisal" as const, value: "0" },
      { ...emptyFee("fixed"), name: "insurance" as const, value: "15,5" },
      { ...emptyFee("pct"), name: "commission" as const, value: "0,005" },
    ];
    expect(errorsOf({ ...bank, fees })).toEqual({
      "fees.1.name": "duplicate",
      "fees.1.value": "range",
      "fees.2.value": "number",
      "fees.3.value": "range",
    });
    const fixed = [{ ...emptyFee("fixed"), value: "100" }];
    expect(errorsOf({ ...markup, terms: [term], fees: fixed })).toEqual({
      "fees.0.kind": "invalid",
    });
  });

  it("выбранные блоки без блоков, взнос 95 %, скидка 100 % оплаты сверх 50 %", () => {
    expect(
      errorsOf({ ...markup, terms: [term], minDownPct: "95", blocksScope: "selected" }),
    ).toEqual({ minDownPct: "range", blocks: "required" });
    expect(errorsOf({ ...newDraft("full", "d1"), discountPct: "55" })).toEqual({
      discountPct: "range",
    });
  });

  it("условия: оба языка, без контактов застройщика (правило 1.2)", () => {
    const base = { ...markup, terms: [term] };
    expect(errorsOf({ ...base, conditions: { ru: "Без справок", uz: "" } })).toEqual({
      conditions: "missingUz",
    });
    const contact = { ru: "Звоните +998 90 123 45 67", uz: "Qo‘ng‘iroq qiling" };
    expect(errorsOf({ ...base, conditions: contact })).toEqual({ conditions: "contacts" });
    expect(validateDraft({ ...base, conditions: { ru: " ", uz: "" } })).toMatchObject({
      ok: true,
      payload: { conditions: null },
    });
  });
});
