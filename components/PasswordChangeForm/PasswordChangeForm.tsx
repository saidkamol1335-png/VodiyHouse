"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { PasswordField } from "@/components/PasswordField";
import { PASSWORD_IDLE, type PasswordChangeAction } from "@/lib/admin/auth/types";
import type { PasswordErrorCode } from "@/lib/admin/authErrors";
import { PASSWORD_RULES } from "@/lib/admin/password";

type PasswordChangeFormProps = {
  /** Server Action (lib/admin/actions/auth.ts); на /dev/parol — подделка. */
  action: PasswordChangeAction;
  /** Email сотрудника — для менеджера паролей (скрытое поле username). */
  email: string;
};

/** Первая смена пароля (С4): временный, новый и повтор — в карточке входа. */
export function PasswordChangeForm({ action, email }: PasswordChangeFormProps) {
  const t = useTranslations("admin.password");
  const [state, formAction, pending] = useActionState(action, PASSWORD_IDLE);
  const min = PASSWORD_RULES.minLength;
  const message = (code: PasswordErrorCode | undefined) => (code ? t(`errors.${code}`, { min }) : undefined);

  return (
    <form className="password-change-form" action={formAction} noValidate>
      {/* Менеджер паролей сохранит новый пароль к этому email. */}
      <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        id="password-current"
        name="current"
        autoComplete="current-password"
        required
        label={t("current")}
        error={message(state.fieldErrors.current)}
      />
      <PasswordField
        id="password-next"
        name="password"
        autoComplete="new-password"
        required
        minLength={min}
        label={t("next")}
        hint={t("rule", { min })}
        error={message(state.fieldErrors.password)}
      />
      <PasswordField
        id="password-repeat"
        name="confirm"
        autoComplete="new-password"
        required
        label={t("repeat")}
        error={message(state.fieldErrors.confirm)}
      />
      {state.error ? <FormStatus tone="error">{message(state.error)}</FormStatus> : null}
      <Button type="submit" block pending={pending} className="password-change-form__submit">
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
