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
  it("руководитель и менеджер — всё (PLAN §10, п. 6)", () => {
    expect(unitsActionsFor("head", ALL)).toBe(ALL);
    expect(unitsActionsFor("manager", ALL)).toBe(ALL);
  });

  it("мобилограф — только чтение, как и действие чтения (PLAN §5; раздел ему пока закрыт)", () => {
    expect(unitsActionsFor("mobilographer", ALL)).toEqual({
      list: { read: ALL.list.read, status: null, edit: null },
      create: null,
      saveRisers: null,
      layoutAvailable: null,
    });
  });
});
