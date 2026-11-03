"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { FactorResult } from "@/lib/admin/secondFactor/types";

type BackupCodesProps = {
  /** null — коды уже выданы раньше: только переход в кабинет. */
  issue: (() => Promise<FactorResult>) | null;
  next: string;
};

const IDLE: FactorResult = { status: "idle" };

/** 10 запасных кодов — один раз (п. 28): «Показать коды» → список → «Я сохранил коды — в кабинет». */
export function BackupCodes({ issue, next }: BackupCodesProps) {
  const t = useTranslations("admin.secondFactor");
  const errors = useTranslations("admin.secondFactor.errors");
  const [state, formAction, pending] = useActionState(async () => (issue ? issue() : IDLE), IDLE);
  if (state.status === "codes") {
    return (
      <div className="second-factor second-factor__step">
        <ol className="second-factor__codes">
          {state.codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ol>
        <Button href={next} block>
          {t("backupDone")}
        </Button>
      </div>
    );
  }
  return (
    <form action={formAction} className="second-factor second-factor__step">
      {issue ? (
        <Button type="submit" block pending={pending}>
          {t("backupShow")}
        </Button>
      ) : (
        <Button href={next} block>
          {t("toCabinet")}
        </Button>
      )}
      {state.status === "error" ? <FormStatus tone="error">{errors(state.error)}</FormStatus> : null}
    </form>
  );
}
