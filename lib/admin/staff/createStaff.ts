import type { StaffRole } from "../access";
import { staffAuthErrorCode, staffDbErrorCode, type AuthErrorLike, type DbErrorLike, type StaffErrorCode } from "../authErrors";
import type { StaffInput } from "../credentials";

// «Добавить сотрудника» без Next.js и Supabase — зависимости подставляются.

export type CreateStaffDeps = {
  generatePassword(): string;
  /** Auth Admin API (ключ service_role), email сразу подтверждён — писем нет. */
  createAuthUser(input: { email: string; password: string }): Promise<{ id: string } | { error: AuthErrorLike }>;
  /** Профиль — сессией руководителя: RLS и автор в журнале. null — успех. */
  insertProfile(row: { id: string; fullName: string; role: StaffRole }): Promise<DbErrorLike | null>;
  /** Откат: пользователь Auth без профиля не должен остаться. */
  deleteAuthUser(id: string): Promise<boolean>;
};

export type CreatedStaff = { id: string; fullName: string; email: string; role: StaffRole };

export type CreateStaffOutcome =
  | { kind: "created"; member: CreatedStaff; password: string }
  | { kind: "error"; code: StaffErrorCode };

/** Пароль генерируется здесь и уходит только в ответ — один раз (решение фазы 1, в. 3). */
export async function createStaffMember(deps: CreateStaffDeps, input: StaffInput): Promise<CreateStaffOutcome> {
  const password = deps.generatePassword();
  const created = await deps.createAuthUser({ email: input.email, password });
  if ("error" in created) return { kind: "error", code: staffAuthErrorCode(created.error) };

  const refused = await deps.insertProfile({ id: created.id, fullName: input.fullName, role: input.role });
  if (refused) {
    await deps.deleteAuthUser(created.id);
    const code = staffDbErrorCode(refused);
    return { kind: "error", code: code === "unknown" ? "createFailed" : code };
  }
  return { kind: "created", member: { id: created.id, ...input }, password };
}
