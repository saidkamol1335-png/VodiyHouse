"use client";

import { useTranslations } from "next-intl";
import { Suspense, useActionState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { LoginNotice } from "@/components/LoginNotice";
import { PasswordField } from "@/components/PasswordField";
import { SIGN_IN_IDLE, type SignInAction } from "@/lib/admin/auth/types";

type LoginFormProps = {
  /** Server Action входа (lib/admin/actions/auth.ts); на служебных страницах — подделка. */
  action: SignInAction;
  /** Режим разработки без ключей Supabase: ссылка в кабинет без входа. Иначе — null. */
  devOpenHref: string | null;
};

/** Email и пароль (решение С6): ошибки полей — под полями, ошибка сервера — над «Войти». */
export function LoginForm({ action, devOpenHref }: LoginFormProps) {
  const t = useTranslations("admin.login");
  const [state, formAction, pending] = useActionState(action, SIGN_IN_IDLE);
  const { email: emailIssue, password: passwordIssue } = state.fieldErrors;

  return (
    <form className="login-form" action={formAction} noValidate>
      {/* useSearchParams на статичном экране входа — только внутри Suspense. */}
      <Suspense fallback={null}>
        <LoginNotice />
      </Suspense>
      <Field
        id="login-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        required
        label={t("email")}
        defaultValue={state.email}
        error={emailIssue ? t(`errors.${emailIssue}`) : undefined}
      />
      <PasswordField
        id="login-password"
        name="password"
        autoComplete="current-password"
        required
        label={t("password")}
        error={passwordIssue ? t(`errors.${passwordIssue}`) : undefined}
      />
      {state.error ? <FormStatus tone="error">{t(`errors.${state.error}`)}</FormStatus> : null}
      <Button type="submit" block pending={pending} className="login-form__submit">
        {pending ? t("pending") : t("submit")}
      </Button>
      {devOpenHref ? (
        <Button href={devOpenHref} variant="ghost" size="sm" block>
          {t("devOpen")}
        </Button>
      ) : null}
    </form>
  );
}
