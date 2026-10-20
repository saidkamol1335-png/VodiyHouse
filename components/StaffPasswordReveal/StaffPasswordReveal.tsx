"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { loginUrlOf } from "@/lib/admin/staff/invite";
import { useCopyForTelegram } from "./useCopyForTelegram";

type StaffPasswordRevealProps = {
  name: string;
  email: string;
  password: string;
  /** «Готово»: родитель убирает панель вместе с паролем. */
  onDone: () => void;
};

// Группы по 4 символа читать и диктовать легче; копируется пароль без пробелов.
const groupsOf = (password: string) => password.match(/.{1,4}/g) ?? [password];

/** Временный пароль один раз (С3): янтарная панель, «Скопировать для Telegram». */
export function StaffPasswordReveal({ name, email, password, onDone }: StaffPasswordRevealProps) {
  const t = useTranslations("admin.staff.reveal");
  // Несколько панелей сразу (новый сотрудник и «Новый пароль» в строке) — свой id у каждой.
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  const message = () => t("telegram", { url: loginUrlOf(window.location.origin), email, password });
  const { state: copyState, copy, fallback } = useCopyForTelegram(message);

  // Фокус на заголовок: скринридер сразу читает, что появился пароль.
  useEffect(() => title.current?.focus(), []);

  return (
    <section className="staff-password" aria-labelledby={titleId}>
      <h3 id={titleId} ref={title} tabIndex={-1} className="staff-password__title">
        {t("title", { name })}
      </h3>
      <p className="staff-password__lead">{t("lead")}</p>
      <dl className="staff-password__grid">
        <dt>{t("email")}</dt>
        <dd className="staff-password__email">{email}</dd>
        <dt>{t("password")}</dt>
        <dd className="staff-password__value">
          {groupsOf(password).map((group, index) => (
            <span key={index} className="staff-password__group">
              {group}
            </span>
          ))}
        </dd>
      </dl>
      {copyState === "copied" ? <FormStatus tone="success">{t("copied")}</FormStatus> : null}
      {copyState === "failed" ? (
        <>
          <FormStatus tone="error">{t("copyFail")}</FormStatus>
          <textarea
            ref={fallback}
            className="field__input field__input--multiline"
            aria-label={t("fallbackLabel")}
            readOnly
            rows={5}
            value={message()}
          />
        </>
      ) : null}
      <div className="staff-password__actions">
        <Button onClick={copy}>
          <Copy size={16} strokeWidth={1.8} aria-hidden />
          {t("copy")}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    </section>
  );
}
