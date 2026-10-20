"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { loginUrlOf } from "@/lib/admin/staff/invite";

type StaffPasswordRevealProps = {
  name: string;
  email: string;
  password: string;
  /** «Готово»: родитель убирает панель вместе с паролем. */
  onDone: () => void;
};

type CopyState = "idle" | "copied" | "failed";

// Группы по 4 символа читать и диктовать легче; копируется пароль без пробелов.
const groupsOf = (password: string) => password.match(/.{1,4}/g) ?? [password];

/** Временный пароль один раз (С3): янтарная панель на месте формы, «Скопировать для Telegram». */
export function StaffPasswordReveal({ name, email, password, onDone }: StaffPasswordRevealProps) {
  const t = useTranslations("admin.staff.reveal");
  const title = useRef<HTMLHeadingElement>(null);
  const fallback = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<CopyState>("idle");
  const message = () => t("telegram", { url: loginUrlOf(window.location.origin), email, password });

  // Фокус на заголовок: скринридер сразу читает, что появился пароль.
  useEffect(() => title.current?.focus(), []);
  // select() сам фокус не переводит — сначала focus(), чтобы Ctrl+C сработал сразу.
  useEffect(() => {
    if (copy !== "failed") return;
    fallback.current?.focus();
    fallback.current?.select();
  }, [copy]);

  async function copyForTelegram() {
    try {
      await navigator.clipboard.writeText(message());
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  }

  return (
    <section className="staff-password" aria-labelledby="staff-password-title">
      <h3 id="staff-password-title" ref={title} tabIndex={-1} className="staff-password__title">
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
      {copy === "copied" ? <FormStatus tone="success">{t("copied")}</FormStatus> : null}
      {copy === "failed" ? (
        <>
          <FormStatus tone="error">{t("copyFail")}</FormStatus>
          <textarea ref={fallback} className="field__input field__input--multiline" readOnly rows={5} value={message()} />
        </>
      ) : null}
      <div className="staff-password__actions">
        <Button onClick={copyForTelegram}>
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
