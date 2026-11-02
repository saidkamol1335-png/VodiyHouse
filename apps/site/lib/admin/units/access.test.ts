import { describe, expect, it } from "vitest";
import { unitsActionsFor } from "./access";
import type { UnitsTabActions } from "./types";

const action = () => Promise.reject(new Error("не вызывается"));
const ALL: UnitsTabActions = {
  list: {
    read: action,
    status: { set: action, revert: action },
    edit: {
      add: action,
      update: action,
      remove: action,
      removeList: action,
      price: action,
      finishing: action,
    },
  },
  create: action,
  saveRisers: action,
  layoutAvailable: action,
};

describe("права на вкладке «Квартиры» — наличием действий", () => {
  it("руководитель — всё", () => {
    expect(unitsActionsFor("head", ALL)).toBe(ALL);
  });

  it("менеджер — чтение, статус с «Отменить» и Н7; ни генератора, ни стояков, ни правок", () => {
    const manager = unitsActionsFor("manager", ALL);
    expect(manager.list.read).toBe(ALL.list.read);
    expect(manager.list.status).toBe(ALL.list.status);
    expect(manager.layoutAvailable).toBe(ALL.layoutAvailable);
    expect(manager.list.edit).toBeNull();
    expect(manager.create).toBeNull();
    expect(manager.saveRisers).toBeNull();
  });

  it("видеограф — только чтение, как и действие чтения (PLAN §5; раздел ему пока закрыт)", () => {
    expect(unitsActionsFor("videographer", ALL)).toEqual({
      list: { read: ALL.list.read, status: null, edit: null },
      create: null,
      saveRisers: null,
      layoutAvailable: null,
    });
  });
});
