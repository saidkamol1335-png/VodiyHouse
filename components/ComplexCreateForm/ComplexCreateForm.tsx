"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { SelectField } from "@/components/SelectField";
import { COMPLEX_NAME_MAX } from "@/lib/admin/complexes/create";
import type { CreateComplexResult, DeveloperOption } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { toUzbekLatin } from "@/lib/translit";

type ComplexCreateFormProps = {
  /** Server Action: успех — переход на страницу нового ЖК; на стенде — подделка. */
  action: FormAction<CreateComplexResult>;
  developers: readonly DeveloperOption[];
  /** Пришли со страницы застройщика (?zastroyshchik=…) — он выбран сразу. */
  developerId?: string | null;
  /** Куда вести, если застройщиков нет. */
  developersHref: string;
};

const IDLE: CreateComplexResult = { status: "idle" };

/** «+ Добавить ЖК»: кнопка раскрывает панель «Застройщик» + «Название» RU | UZ (как С2, Д3). */
export function ComplexCreateForm(props: ComplexCreateFormProps) {
  const t = useTranslations("admin.complexes.create");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="complex-create complex-create--closed">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={16} strokeWidth={2} aria-hidden />
          {t("add")}
        </Button>
      </div>
    );
  }
  return <ComplexCreatePanel {...props} onClose={() => setOpen(false)} />;
}

type Failed = Extract<CreateComplexResult, { status: "error" }> | null;

function ComplexCreatePanel(props: ComplexCreateFormProps & { onClose: () => void }) {
  const { action, developers } = props;
  const t = useTranslations("admin");
  const [state, formAction, pending] = useActionState(
    (_previous: CreateComplexResult, formData: FormData) => action(formData),
    IDLE,
  );
  const failed = state.status === "error" ? state : null;
  if (developers.length === 0) return <NoDevelopers href={props.developersHref} />;
  return (
    <AdminPanel title={t("complexes.create.title")} wide>
      <form className="complex-create" action={formAction} noValidate>
        <CreateFields developers={developers} developerId={props.developerId} failed={failed} />
        {failed?.error ? (
          <FormStatus tone="error">{t(`developers.errors.${failed.error}`)}</FormStatus>
        ) : null}
        <CreateActions pending={pending} onClose={props.onClose} />
      </form>
    </AdminPanel>
  );
}

/** Без застройщиков ЖК не создать: ведём к их списку. */
function NoDevelopers({ href }: { href: string }) {
  const t = useTranslations("admin.complexes.create");
  return (
    <AdminPanel title={t("title")} wide>
      <p className="complex-create__empty">
        {t("noDevelopers")} <Link href={href}>{t("toDevelopers")}</Link>
      </p>
    </AdminPanel>
  );
}

type CreateFieldsProps = Pick<ComplexCreateFormProps, "developers" | "developerId"> & {
  failed: Failed;
};

function CreateFields({ developers, developerId, failed }: CreateFieldsProps) {
  const t = useTranslations("admin");
  const developerIssue = failed?.fieldErrors.developerId;
  const nameIssue = failed?.fieldErrors.name;
  return (
    <>
      <SelectField
        id="complex-create-developer"
        name="developerId"
        label={t("complexes.create.developer")}
        placeholder={t("complexes.create.developerPlaceholder")}
        options={developers.map((developer) => ({ value: developer.id, label: developer.name }))}
        defaultValue={failed?.fields.developerId || developerId || ""}
        error={developerIssue ? t(`complexes.issues.${developerIssue}`) : undefined}
      />
      <BilingualField
        id="complex-create-name"
        name="name"
        label={t("complexes.create.name")}
        uzLabel={t("complexes.create.nameUz")}
        maxLength={COMPLEX_NAME_MAX}
        defaultValue={failed?.fields.name}
        mirrorUz={toUzbekLatin}
        error={nameIssue ? t(`developers.issues.${nameIssue}`, { min: 0 }) : undefined}
      />
      {nameIssue ? null : <p className="field__meta">{t("complexes.create.nameHint")}</p>}
    </>
  );
}

function CreateActions({ pending, onClose }: { pending: boolean; onClose: () => void }) {
  const t = useTranslations("admin.complexes.create");
  return (
    <div className="complex-create__actions">
      <Button type="submit" pending={pending} className="complex-create__action">
        {pending ? t("pending") : t("submit")}
      </Button>
      <Button variant="ghost" onClick={onClose} className="complex-create__action">
        {t("cancel")}
      </Button>
    </div>
  );
}
