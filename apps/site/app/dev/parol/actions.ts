"use server";

import { devOnly } from "../devOnly";
import { redirect } from "next/navigation";
import { changeFirstPassword, type ChangePasswordDeps } from "@/lib/admin/auth/changePassword";
import type { PasswordState } from "@/lib/admin/auth/types";
import { parsePasswordChange } from "@/lib/admin/credentials";
import { DEMO_EMAIL, DEMO_TEMPORARY_PASSWORD } from "./demo";

// Подделка Supabase для стенда: настоящее ядро смены пароля, но без Auth и базы.
const demoDeps: ChangePasswordDeps = {
  verifyCurrentPassword: async (_email, password) =>
    password === DEMO_TEMPORARY_PASSWORD ? "ok" : "wrong",
  updatePassword: async () => null,
  clearMustChange: async () => true,
  signOutOthers: async () => undefined,
};

/** /dev/parol: успех ведёт в кабинет (без ключей Supabase он открыт), ошибки — как у настоящей формы. */
export async function demoChangePasswordAction(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  devOnly();
  const fields = parsePasswordChange(formData);
  const outcome = await changeFirstPassword(demoDeps, {
    ...fields,
    userId: "demo",
    email: DEMO_EMAIL,
    role: "manager",
  });
  if (outcome.kind === "error") return { error: outcome.code, fieldErrors: outcome.fieldErrors };
  redirect(outcome.to);
}
