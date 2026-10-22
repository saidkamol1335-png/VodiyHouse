import type { StaffRole } from "../access";
import type { UnitsTabActions } from "./types";

// Права на вкладке «Квартиры» — наличием действий: кнопки нет, если её действия не передали.
// Сервер всё равно проверяет роль в каждом действии и в функции базы (PLAN §5).

/**
 * Руководитель — всё. Менеджер (Н2, Н7, PLAN §5) — чтение, статус квартир с «Отменить» и
 * «доступна / нет в наличии» у блока без списка: без генератора, стояков, правок, цены и удаления.
 * TODO-заказчик «цены — менеджер?» (ТЗ 1.3, 13.1–13.2): да — сюда edit.price и роль в функции базы.
 */
export function unitsActionsFor(role: StaffRole, all: UnitsTabActions): UnitsTabActions {
  switch (role) {
    case "head":
      return all;
    case "manager":
      return {
        list: { read: all.list.read, status: all.list.status, edit: null },
        create: null,
        saveRisers: null,
        layoutAvailable: all.layoutAvailable,
      };
    case "videographer":
      return {
        list: { read: all.list.read, status: null, edit: null },
        create: null,
        saveRisers: null,
        layoutAvailable: null,
      };
  }
}
