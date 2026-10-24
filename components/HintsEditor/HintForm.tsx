"use client";

import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import {
  HINT_LIMITS,
  type HintActionResult,
  type HintErrors,
  type HintItem,
} from "@/lib/admin/hints/hints";

type HintFormProps = {
  item: HintItem;
  result: HintActionResult;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
};

/** Термин и пояснение RU | UZ, «показывать «?»»; ошибки — под полями, общая — строкой. */
export function HintForm({ item, result, pending, onSubmit, onCancel }: HintFormProps) {
  const t = useTranslations("admin");
  const errors: HintErrors = result.status === "error" ? result.fieldErrors : {};
  const issue = (field: keyof HintErrors) => {
    const code = errors[field];
    return code ? t(`developers.issues.${code}`, { min: 0 }) : undefined;
  };
  const prefix = `hint-${item.slug}`;
  return (
    <form className="hints-editor__form" action={onSubmit} noValidate>
      <input type="hidden" name="slug" value={item.slug} />
      <BilingualField
        id={`${prefix}-term`}
        name="term"
        label={t("hints.fields.term")}
        uzLabel={t("hints.fields.termUz")}
        maxLength={HINT_LIMITS.termMax}
        defaultValue={item.term}
        required
        error={issue("term")}
      />
      <BilingualField
        id={`${prefix}-text`}
        name="text"
        label={t("hints.fields.text")}
        uzLabel={t("hints.fields.textUz")}
        maxLength={HINT_LIMITS.textMax}
        defaultValue={item.text}
        multiline
        required
        error={issue("text")}
      />
      <label className="hints-editor__active">
        <input type="checkbox" name="active" defaultChecked={item.isActive} />
        {t("hints.fields.active")}
      </label>
      <FormFooter result={result} pending={pending} onCancel={onCancel} />
    </form>
  );
}

type FormFooterProps = Pick<HintFormProps, "result" | "pending" | "onCancel">;

/** Общая ошибка (нет прав, нет связи) и кнопки «Сохранить» / «Отмена». */
function FormFooter({ result, pending, onCancel }: FormFooterProps) {
  const t = useTranslations("admin");
  return (
    <>
      {result.status === "error" && result.error ? (
        <p className="field__error" role="alert">
          {t(`developers.errors.${result.error}`)}
        </p>
      ) : null}
      <div className="hints-editor__actions">
        <Button type="submit" size="sm" pending={pending}>
          {t("dictionaries.save")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          {t("dictionaries.cancel")}
        </Button>
      </div>
    </>
  );
}
