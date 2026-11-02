import { staffDbErrorCode, type DbErrorLike, type StaffErrorCode } from "../authErrors";

// Отключить / включить и «Новый пароль» без Next.js и Supabase — зависимости подставляются.

/** Бан в Auth «навсегда» (100 лет): пароль и обновление сессии перестают работать. */
export const BAN_DURATION = "876000h";

export type ManageStaffDeps = {
  /** Сессией руководителя: RLS, триггеры (свой профиль, последний руководитель), журнал. */
  updateActive(id: string, active: boolean): Promise<{ rows: number } | { error: DbErrorLike }>;
  /** Auth Admin API: бан или снятие бана. false — не удалось. */
  setBan(id: string, banned: boolean): Promise<boolean>;
  /** Функция базы require_password_change сессией руководителя. null — успех. */
  requirePasswordChange(id: string): Promise<DbErrorLike | null>;
  setPassword(id: string, password: string): Promise<boolean>;
  generatePassword(): string;
};

type StaffTarget = { actorId: string; staffId: string };

export type SetActiveOutcome = { kind: "done" } | { kind: "error"; code: StaffErrorCode };
export type ResetPasswordOutcome = { kind: "reset"; password: string } | { kind: "error"; code: StaffErrorCode };

/**
 * Сначала база (она проверяет права и «последнего руководителя»), потом Auth. Если второй шаг
 * не прошёл, список покажет расхождение, и повтор того же действия его исправит.
 */
export async function setStaffActive(
  deps: ManageStaffDeps,
  { actorId, staffId, active }: StaffTarget & { active: boolean },
): Promise<SetActiveOutcome> {
  if (actorId === staffId) return { kind: "error", code: "self" };
  const updated = await deps.updateActive(staffId, active);
  if ("error" in updated) return { kind: "error", code: staffDbErrorCode(updated.error) };
  if (updated.rows === 0) return { kind: "error", code: "notFound" };
  if (!(await deps.setBan(staffId, !active))) return { kind: "error", code: active ? "unbanFailed" : "banFailed" };
  return { kind: "done" };
}

/** Новый временный пароль: база отмечает «сменить при входе», затем Auth меняет пароль. */
export async function resetStaffPassword(deps: ManageStaffDeps, { actorId, staffId }: StaffTarget): Promise<ResetPasswordOutcome> {
  if (actorId === staffId) return { kind: "error", code: "self" };
  const refused = await deps.requirePasswordChange(staffId);
  if (refused) return { kind: "error", code: staffDbErrorCode(refused) };
  const password = deps.generatePassword();
  if (!(await deps.setPassword(staffId, password))) return { kind: "error", code: "resetFailed" };
  return { kind: "reset", password };
}
