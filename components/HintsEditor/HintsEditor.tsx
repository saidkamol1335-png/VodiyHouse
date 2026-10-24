"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import type { FormAction } from "@/lib/admin/developers/types";
import { HINT_IDLE, type HintActionResult, type HintItem } from "@/lib/admin/hints/hints";
import { HintForm } from "./HintForm";

type HintsEditorProps = {
  items: readonly HintItem[];
  action: FormAction<HintActionResult>;
};

/**
 * «Справочники → Подсказки «?»» (шаг 2.8, ТЗ 4.4): набор задаёт сайт — здесь термин и пояснение
 * RU | UZ и «показывать «?»». Правка на месте, как у справочников (Д6); открыта одна строка.
 */
export function HintsEditor({ items, action }: HintsEditorProps) {
  const t = useTranslations("admin.hints");
  const [editing, setEditing] = useState<string | null>(null);
  const [result, setResult] = useState<HintActionResult>(HINT_IDLE);
  const [pending, startTransition] = useTransition();
  const submit = (formData: FormData) =>
    startTransition(async () => {
      const next = await action(formData);
      setResult(next);
      if (next.status === "done") setEditing(null);
    });
  return (
    <AdminPanel title={t("title")} wide>
      <p className="hints-editor__lead">{t("lead")}</p>
      {result.status === "done" && editing === null ? (
        <FormStatus tone="success">{t("saved")}</FormStatus>
      ) : null}
      <ul className="hints-editor__list">
        {items.map((item) => (
          <li key={item.slug} className="hints-editor__row" data-testid="hint-row">
            {editing === item.slug ? (
              <HintForm
                item={item}
                result={result}
                pending={pending}
                onSubmit={submit}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <HintView
                item={item}
                onEdit={() => {
                  setResult(HINT_IDLE);
                  setEditing(item.slug);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </AdminPanel>
  );
}

function HintView({ item, onEdit }: { item: HintItem; onEdit: () => void }) {
  const t = useTranslations("admin.hints");
  return (
    <>
      <div className="hints-editor__text">
        <span className="hints-editor__term">
          {item.term.ru}
          <span className="hints-editor__uz" lang="uz">
            {item.term.uz}
          </span>
        </span>
        <span className="hints-editor__explain">{item.text.ru}</span>
      </div>
      {item.isActive ? null : (
        <Badge tone="neutral" size="sm" dot>
          {t("hidden")}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onEdit}
        aria-label={t("editNamed", { term: item.term.ru })}
      >
        {t("edit")}
      </Button>
    </>
  );
}
