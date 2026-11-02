"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import {
  DICTIONARIES,
  DICTIONARY_LIMITS,
  LOCATION_KINDS,
  type DictionaryItem,
  type DictionaryItemErrors,
  type DictionaryKey,
} from "@/lib/admin/dictionaries/definitions";

type DictionaryItemFormProps = {
  dictionary: DictionaryKey;
  /** null — новое значение («+ Добавить»). */
  item: DictionaryItem | null;
  errors: DictionaryItemErrors;
  pending: boolean;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
};

/** Правка на месте (Д6): название RU | UZ, второе поле (если есть у справочника), вид у городов. */
export function DictionaryItemForm({
  dictionary,
  item,
  errors,
  pending,
  onSubmit,
  onCancel,
}: DictionaryItemFormProps) {
  const t = useTranslations("admin");
  const { second, hasKind } = DICTIONARIES[dictionary];
  const prefix = `${dictionary}-${item?.id ?? "new"}`;
  const issue = (field: keyof DictionaryItemErrors) => {
    const code = errors[field];
    return code ? t(`developers.issues.${code}`, { min: 0 }) : null;
  };
  const problems = [issue("name"), issue("second"), issue("kind")].filter(Boolean);
  return (
    <form className="dictionary-form" action={onSubmit} noValidate>
      <input type="hidden" name="dictionary" value={dictionary} />
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <BilingualField
        id={`${prefix}-name`}
        name="name"
        label={t("dictionaries.fields.name")}
        uzLabel={t("dictionaries.fields.nameUz")}
        maxLength={DICTIONARY_LIMITS.nameMax}
        defaultValue={item?.name}
        required
      />
      {second ? <SecondField prefix={prefix} second={second} item={item} /> : null}
      {hasKind ? <KindSelect id={`${prefix}-kind`} initial={item?.kind ?? "district"} /> : null}
      {problems.length > 0 ? <p className="field__error">{problems.join(" · ")}</p> : null}
      <ItemFormActions isNew={!item} pending={pending} onCancel={onCancel} />
    </form>
  );
}

type SecondFieldProps = {
  prefix: string;
  second: NonNullable<(typeof DICTIONARIES)[DictionaryKey]["second"]>;
  item: DictionaryItem | null;
};

/** Второе поле справочника (у районов — центр, у тем — пояснение): RU | UZ, многострочное. */
function SecondField({ prefix, second, item }: SecondFieldProps) {
  const t = useTranslations("admin.dictionaries.fields");
  return (
    <BilingualField
      id={`${prefix}-second`}
      name="second"
      label={t(second)}
      uzLabel={t(`${second}Uz`)}
      maxLength={DICTIONARY_LIMITS.secondMax}
      defaultValue={item?.second ?? undefined}
      multiline
    />
  );
}

function ItemFormActions({
  isNew,
  pending,
  onCancel,
}: {
  isNew: boolean;
  pending: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations("admin.dictionaries");
  return (
    <div className="dictionary-form__actions">
      <Button type="submit" size="sm" pending={pending}>
        {isNew ? t("add") : t("save")}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        {t("cancel")}
      </Button>
    </div>
  );
}

/** Город или район — системный список, как роль сотрудника (неуправляемый: React сбрасывает форму). */
function KindSelect({ id, initial }: { id: string; initial: string }) {
  const t = useTranslations("admin.dictionaries");
  return (
    <div className="field dictionary-form__kind">
      <label className="field__label" htmlFor={id}>
        {t("fields.kind")}
      </label>
      <span className="dictionary-form__select">
        <select
          id={id}
          name="kind"
          className="field__input dictionary-form__select-input"
          defaultValue={initial}
        >
          {LOCATION_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`kinds.${kind}`)}
            </option>
          ))}
        </select>
        <ChevronDown className="dictionary-form__chevron" size={16} aria-hidden="true" />
      </span>
    </div>
  );
}
