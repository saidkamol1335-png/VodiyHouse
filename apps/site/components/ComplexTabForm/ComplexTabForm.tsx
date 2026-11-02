"use client";

import { useTranslations } from "next-intl";
import type { FormEvent, ReactNode } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";

type ComplexTabFormProps = {
  title: string;
  lead: ReactNode;
  complexId: string;
  /** useTabSave: ответ действия, отправка без сброса, «Уйти без сохранения?». */
  save: {
    state: Parameters<typeof ComplexSaveFeedback>[0]["state"];
    pending: boolean;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onInput: () => void;
  };
  /** Слева от «Сохранить вкладку»: «+ Добавить видео». */
  extra?: ReactNode;
  children: ReactNode;
};

/** Вкладка ЖК на обычных полях («Видео», «Детали», «Документы»): пояснение, строки, «Сохранить вкладку». */
export function ComplexTabForm({ title, lead, complexId, save, extra, children }: ComplexTabFormProps) {
  const t = useTranslations("admin.complexes");
  return (
    <AdminPanel title={title} wide>
      <form className="complex-tab" onSubmit={save.onSubmit} onInput={save.onInput} noValidate>
        <input type="hidden" name="id" value={complexId} />
        <p className="complex-tab__lead">{lead}</p>
        {children}
        <div className="complex-tab__actions">
          {extra}
          <div className="complex-tab__save">
            <ComplexSaveFeedback state={save.state} />
            <Button type="submit" pending={save.pending}>
              {save.pending ? t("pending") : t("save")}
            </Button>
          </div>
        </div>
      </form>
    </AdminPanel>
  );
}
