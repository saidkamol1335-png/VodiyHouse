"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import {
  publishProgressReportAction,
  returnProgressReportAction,
} from "@/lib/admin/actions/progressReview";
import type { ReviewActionResult } from "@/lib/admin/progress/types";

const NOTE_MAX = 300;

/**
 * Решение по отчёту (мокап CabReview): «Проверено по правилу 1.2…» — без отметки «Опубликовать»
 * неактивна (и база без неё не опубликует); «Вернуть видеографу» — с причиной (в мокапе её не было:
 * видеограф не знал бы, что исправить).
 */
export function ReviewDecision({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations("admin.video.review");
  const tError = useTranslations("admin.developers.errors");
  const [checked, setChecked] = useState(false);
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (action: (data: FormData) => Promise<ReviewActionResult>) => (data: FormData) =>
    start(async () => {
      const result = await action(data);
      if (result.status === "error") return setError(tError(result.error));
      onDone();
    });
  return (
    <div className="progress-review__decision">
      <form action={run(publishProgressReportAction)} className="progress-review__publish">
        <input type="hidden" name="id" value={id} />
        <label className="progress-review__check">
          <input
            type="checkbox"
            name="rule12"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          {t("rule12")}
        </label>
        <Button type="submit" block disabled={!checked} pending={pending && !returning}>
          <Check size={18} aria-hidden="true" />
          {t("publish")}
        </Button>
      </form>
      {returning ? (
        <ReturnForm id={id} pending={pending} action={run(returnProgressReportAction)} />
      ) : (
        <Button variant="danger" block onClick={() => setReturning(true)}>
          {t("return")}
        </Button>
      )}
      {error ? <FormStatus tone="error">{error}</FormStatus> : null}
    </div>
  );
}

type ReturnFormProps = { id: string; pending: boolean; action: (data: FormData) => void };

/** «Что исправить» и «Вернуть видеографу». */
function ReturnForm({ id, pending, action }: ReturnFormProps) {
  const t = useTranslations("admin.video.review");
  return (
    <form action={action} className="progress-review__return">
      <input type="hidden" name="id" value={id} />
      <label className="progress-review__label" htmlFor="progress-return-note">
        {t("noteLabel")}
      </label>
      <textarea
        id="progress-return-note"
        name="note"
        required
        maxLength={NOTE_MAX}
        rows={3}
        placeholder={t("notePlaceholder")}
      />
      <Button type="submit" variant="danger" block pending={pending}>
        {t("return")}
      </Button>
    </form>
  );
}
