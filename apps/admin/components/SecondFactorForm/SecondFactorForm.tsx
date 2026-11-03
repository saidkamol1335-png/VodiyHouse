"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import type { FactorResult } from "@/lib/admin/secondFactor/types";

type FactorAction = (formData: FormData) => Promise<FactorResult>;

type SecondFactorFormProps = {
  /** Telegram уже привязан: сразу «Отправить код». */
  telegram: boolean;
  /** Запасные коды выданы — можно войти без Telegram. */
  hasBackup: boolean;
  actions: { link: FactorAction; send: FactorAction; verify: FactorAction; backup: FactorAction };
};

const IDLE: FactorResult = { status: "idle" };

function useFactor(action: FactorAction) {
  return useActionState((_previous: FactorResult, formData: FormData) => action(formData), IDLE);
}

/**
 * Экран второго фактора руководителя (PLAN §10, пп. 8, 28): привязка Telegram при первом входе,
 * код из Telegram, запасной код. После первого подтверждения — экран 10 запасных кодов (/kod/zapasnye).
 */
export function SecondFactorForm({ telegram, hasBackup, actions }: SecondFactorFormProps) {
  const [backupMode, setBackupMode] = useState(false);
  const [verified, verifyAction, verifying] = useFactor(backupMode ? actions.backup : actions.verify);
  return (
    <div className="second-factor">
      {telegram ? <SendCode action={actions.send} /> : <LinkTelegram action={actions.link} />}
      {telegram || hasBackup ? (
        <CodeForm
          backup={backupMode}
          state={verified}
          action={verifyAction}
          pending={verifying}
          onToggle={hasBackup ? () => setBackupMode(!backupMode) : null}
        />
      ) : null}
    </div>
  );
}

function ErrorLine({ state }: { state: FactorResult }) {
  const t = useTranslations("admin.secondFactor.errors");
  return state.status === "error" ? <FormStatus tone="error">{t(state.error)}</FormStatus> : null;
}

function LinkTelegram({ action }: { action: FactorAction }) {
  const t = useTranslations("admin.secondFactor");
  const [state, formAction, pending] = useFactor(action);
  return (
    <form action={formAction} className="second-factor__step">
      <p className="second-factor__lead">{t("linkLead")}</p>
      {state.status === "link" ? (
        <>
          <Button href={state.url} className="second-factor__open">
            {t("openBot")}
          </Button>
          <p className="second-factor__hint">{t("linkHint")}</p>
        </>
      ) : (
        <Button type="submit" pending={pending}>
          {t("link")}
        </Button>
      )}
      <ErrorLine state={state} />
    </form>
  );
}

function SendCode({ action }: { action: FactorAction }) {
  const t = useTranslations("admin.secondFactor");
  const [state, formAction, pending] = useFactor(action);
  return (
    <form action={formAction} className="second-factor__step">
      <p className="second-factor__lead">{t("sendLead")}</p>
      <Button type="submit" variant={state.status === "sent" ? "ghost" : "primary"} pending={pending}>
        {state.status === "sent" ? t("resend") : t("send")}
      </Button>
      {state.status === "sent" ? <FormStatus tone="success">{t("sent")}</FormStatus> : null}
      <ErrorLine state={state} />
    </form>
  );
}

type CodeFormProps = {
  backup: boolean;
  state: FactorResult;
  action: (formData: FormData) => void;
  pending: boolean;
  onToggle: (() => void) | null;
};

function CodeForm({ backup, state, action, pending, onToggle }: CodeFormProps) {
  const t = useTranslations("admin.secondFactor");
  return (
    <form action={action} className="second-factor__step" noValidate>
      <Field
        key={backup ? "backup" : "code"}
        id="second-factor-code"
        name="code"
        label={backup ? t("backupLabel") : t("codeLabel")}
        placeholder={backup ? "ABCD-EFGH" : "123456"}
        inputMode={backup ? "text" : "numeric"}
        autoComplete="one-time-code"
        maxLength={backup ? 9 : 6}
        required
      />
      <Button type="submit" block pending={pending}>
        {t("confirm")}
      </Button>
      <ErrorLine state={state} />
      {onToggle ? (
        <button type="button" className="second-factor__switch" onClick={onToggle}>
          {backup ? t("useTelegram") : t("useBackup")}
        </button>
      ) : null}
    </form>
  );
}
