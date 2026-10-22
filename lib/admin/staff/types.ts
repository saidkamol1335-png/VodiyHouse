import type { StaffErrorCode } from "../authErrors";
import type { StaffFields } from "../credentials";
import type { CreatedStaff } from "./createStaff";

// Ответы действий «Сотрудников» — отдельно от "use server" файла (там только функции).
// Пароль приходит в ответе один раз и живёт только в состоянии компонента до «Готово».

export type StaffFormErrors = Partial<Record<"fullName" | "email" | "role", StaffErrorCode>>;

export type CreateStaffResult =
  | { status: "idle" }
  | { status: "created"; member: CreatedStaff; password: string }
  | {
      status: "error";
      error: StaffErrorCode | null;
      fieldErrors: StaffFormErrors;
      fields: StaffFields;
    };

export const CREATE_STAFF_IDLE: CreateStaffResult = { status: "idle" };

/** Только FormData: прошлое состояние (с паролем) на сервер не отправляется. */
export type CreateStaffAction = (formData: FormData) => Promise<CreateStaffResult>;

export type StaffActionResult = { status: "done" } | { status: "error"; error: StaffErrorCode };
export type ResetPasswordResult =
  { status: "reset"; password: string } | { status: "error"; error: StaffErrorCode };

export type StaffRowActionSet = {
  /** Поля формы: id, active = "true" | "false". */
  setActive: (formData: FormData) => Promise<StaffActionResult>;
  /** Поле формы: id. */
  resetPassword: (formData: FormData) => Promise<ResetPasswordResult>;
};
