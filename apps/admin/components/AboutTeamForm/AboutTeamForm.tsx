"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { TeamPhoto } from "@vh/shared/about";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { MediaDrop } from "@/components/MediaDrop";
import { aboutField, newTeamDraft, TEAM_LIMITS, type AboutErrors, type AboutIssue, type AboutResult, type TeamDraft } from "@/lib/admin/about/forms";
import type { FormAction } from "@/lib/admin/developers/types";
import { refuseUpload, UploadRefused } from "@/lib/admin/storageUpload";
import { DEFAULT_FOCUS, MEDIA_BUCKET, mediaPath, mediaPublicUrl, type ProcessedImage } from "@/lib/media";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useTabSave } from "@/lib/ui/useTabSave";

type AboutTeamFormProps = { members: readonly TeamDraft[]; action: FormAction<AboutResult> };

const swapped = <T,>(rows: readonly T[], from: number, to: number): T[] => {
  const next = [...rows];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
};

/**
 * «Команда» на /o-nas (правки 15.11, п. 25): сотрудник — фото, имя, должность на двух языках и отметка
 * письменного согласия (без неё не сохранится: имя и фото — персональные данные). Порядок — как здесь.
 */
export function AboutTeamForm({ members, action }: AboutTeamFormProps) {
  const t = useTranslations("admin.about.team");
  const tc = useTranslations("admin.complexes");
  const save = useTabSave(action, tc("unsaved"));
  const draft = useDraftRows(members, { dirty: save.dirty, savedAt: save.savedAt, markDirty: save.onInput });
  const errors: AboutErrors = save.state.status === "error" ? save.state.errors : {};
  // Портрет, загруженный, но ещё не сохранённый в запись: заменили или убрали — файл удаляется сразу
  // (сохранённые убирает действие «Сохранить», lib/admin/actions/about.ts). Иначе — сирота в media/team/.
  const saved = new Set(members.flatMap((member) => (member.photo ? [member.photo.path] : [])));
  const dropUnsaved = (photo: TeamPhoto | null) => {
    if (photo && !saved.has(photo.path)) void createSupabaseBrowserClient().storage.from(MEDIA_BUCKET).remove([photo.path]);
  };
  const add = (
    <Button variant="ghost" size="sm" disabled={draft.rows.length >= TEAM_LIMITS.maxRows} onClick={() => draft.change((rows) => [...rows, newTeamDraft()])}>
      + {t("add")}
    </Button>
  );
  return (
    <ComplexTabForm title={t("title")} lead={t("lead")} save={save} extra={add}>
      {draft.rows.length === 0 ? <p className="complex-faq-form__empty">{t("empty")}</p> : null}
      <ol className="complex-faq-form">
        {draft.rows.map((row, index) => (
          <TeamRow
            key={row.key}
            row={row}
            index={index}
            last={index === draft.rows.length - 1}
            errors={errors[row.key]}
            onMove={(by) => draft.change((rows) => swapped(rows, index, index + by))}
            onRemove={() => {
              dropUnsaved(row.photo);
              draft.remove(row.key);
            }}
            onPhoto={(photo) => {
              dropUnsaved(row.photo);
              draft.change((rows) => rows.map((item) => (item.key === row.key ? { ...item, photo } : item)));
            }}
          />
        ))}
      </ol>
    </ComplexTabForm>
  );
}

type TeamRowProps = {
  row: TeamDraft;
  index: number;
  last: boolean;
  errors: AboutErrors[string] | undefined;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
  onPhoto: (photo: TeamPhoto | null) => void;
};

function TeamRow({ row, index, last, errors, onMove, onRemove, onPhoto }: TeamRowProps) {
  const t = useTranslations("admin.about");
  const issue = (code: AboutIssue | undefined) => (code ? t(`issues.${code}`) : undefined);
  return (
    <li className="complex-faq-form__row" role="group" aria-label={t("team.row", { n: index + 1 })}>
      <input type="hidden" name="teamKey" value={row.key} />
      <input type="hidden" name={aboutField(row.key, "id")} value={row.id} />
      <input type="hidden" name={aboutField(row.key, "photo")} value={row.photo ? JSON.stringify(row.photo) : ""} />
      <input type="hidden" name={aboutField(row.key, "consentAt")} value={row.consentAt ?? ""} />
      <TeamPhotoDrop memberId={row.id} photo={row.photo} onChange={onPhoto} />
      <div className="complex-faq-form__fields">
        <Field id={`about-${aboutField(row.key, "name")}`} name={aboutField(row.key, "name")} label={t("team.name")} maxLength={TEAM_LIMITS.nameMax} defaultValue={row.name} error={issue(errors?.name)} />
        <BilingualField id={`about-${aboutField(row.key, "position")}`} name={aboutField(row.key, "position")} label={t("team.position")} uzLabel={t("team.positionUz")} maxLength={TEAM_LIMITS.positionMax} defaultValue={row.position} error={issue(errors?.position)} />
        <label className="about-team-form__consent">
          <input type="checkbox" name={aboutField(row.key, "consent")} defaultChecked={Boolean(row.consentAt)} />
          <span>
            {t("team.consent")}
            {row.consentAt ? <small> · {t("team.consentSince", { date: row.consentAt.slice(0, 10) })}</small> : null}
          </span>
        </label>
        {errors?.consent ? <FormStatus tone="error">{issue(errors.consent)}</FormStatus> : null}
      </div>
      <div className="complex-faq-form__tools">
        <button type="button" className="complex-faq-form__tool" aria-label={t("team.up")} aria-disabled={index === 0} onClick={() => index > 0 && onMove(-1)}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("team.down")} aria-disabled={last} onClick={() => !last && onMove(1)}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("team.remove")} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

const YEAR_SECONDS = "31536000";

/** Портрет: файл сразу в бакет media/team/<id сотрудника>/; в запись он попадёт по «Сохранить». */
function TeamPhotoDrop({ memberId, photo, onChange }: { memberId: string; photo: TeamPhoto | null; onChange: (photo: TeamPhoto | null) => void }) {
  const t = useTranslations("admin.about.team");
  const tErrors = useTranslations("admin.developers.errors");
  const [error, setError] = useState<string | null>(null);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const upload = async (image: ProcessedImage) => {
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const path = mediaPath({ type: "team", id: memberId }, image.type);
    try {
      const uploaded = await supabase.storage.from(MEDIA_BUCKET).upload(path, image.blob, { contentType: image.type, cacheControl: YEAR_SECONDS, upsert: false });
      if (uploaded.error) await refuseUpload(supabase, uploaded.error);
      onChange({ path, width: image.width, height: image.height, blur: image.blur });
    } catch (failure) {
      setError(tErrors(failure instanceof UploadRefused ? failure.code : "network"));
      throw failure;
    }
  };
  return (
    <div className="about-team-form__photo">
      <MediaDrop
        id={`about-team-${memberId}-photo`}
        kind="photo"
        variant="tile"
        label={t("photo")}
        value={photo ? { src: mediaPublicUrl(supabaseUrl, photo.path), width: photo.width, height: photo.height, focus: DEFAULT_FOCUS } : null}
        onPrepared={upload}
        onRemove={() => onChange(null)}
      />
      {error ? <FormStatus tone="error">{error}</FormStatus> : null}
    </div>
  );
}
