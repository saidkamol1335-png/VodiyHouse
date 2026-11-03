import type { StaffRole } from "../access";
import type { UnitsTabActions } from "./types";

// Права на вкладке «Квартиры» — наличием действий: кнопки нет, если её действия не передали.
// Сервер всё равно проверяет роль в каждом действии и в функции базы (PLAN §5).

/**
 * Руководитель и менеджер — всё (PLAN §10, п. 6: менеджер правит ЖК и квартиры — генератор,
 * стояки, правки, цены, удаление; база с фазы B разрешает ему те же функции). Мобилограф — чтение.
 */
export function unitsActionsFor(role: StaffRole, all: UnitsTabActions): UnitsTabActions {
  switch (role) {
    case "head":
    case "manager":
      return all;
    case "mobilographer":
      return {
        list: { read: all.list.read, status: null, edit: null },
        create: null,
        saveRisers: null,
        layoutAvailable: null,
      };
  }
}
