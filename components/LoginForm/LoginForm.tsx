"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

type LoginFormProps = {
  /** Режим разработки: ссылка в кабинет без входа. В продакшене — null. */
  devOpenHref: string | null;
};

const ICON = { size: 18, strokeWidth: 1.8 } as const;

/** Email и пароль. Настоящий вход — Supabase Auth в фазе 1; сейчас форма только сообщает об этом. */
export function LoginForm({ devOpenHref }: LoginFormProps) {
  const t = useTranslations("admin.login");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  const revealLabel = passwordVisible ? t("hidePassword") : t("showPassword");
  const reveal = (
    <button
      type="button"
      className="icon-button icon-button--sm icon-button--bare"
      aria-label={revealLabel}
      aria-pressed={passwordVisible}
      onClick={() => setPasswordVisible((visible) => !visible)}
    >
      {passwordVisible ? <EyeOff {...ICON} aria-hidden /> : <Eye {...ICON} aria-hidden />}
    </button>
  );

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <Field id="login-email" name="email" type="email" inputMode="email" autoComplete="username" required label={t("email")} />
      <Field
        id="login-password"
        name="password"
        type={passwordVisible ? "text" : "password"}
        autoComplete="current-password"
        required
        label={t("password")}
        trailing={reveal}
      />
      <Button type="submit" block className="login-form__submit">
        {t("submit")}
      </Button>
      {submitted ? (
        <p className="login-form__status" role="status">
          {t("phase1")}
        </p>
      ) : null}
      {devOpenHref ? (
        <Button href={devOpenHref} variant="ghost" size="sm" block>
          {t("devOpen")}
        </Button>
      ) : null}
    </form>
  );
}
