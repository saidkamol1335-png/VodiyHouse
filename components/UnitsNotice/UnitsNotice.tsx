"use client";

import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FormStatus } from "@/components/FormStatus";

// «Создано: N квартир» после генератора. Настоящее действие сбрасывает тег ЖК, страница тут же
// перерисовывается уже со списком, и генератор со своим ответом исчезает — поэтому ответ
// хранится выше (провайдер стоит над переключением «генератор → стояки») и показывается там.

export type CreatedNotice = { blockId: string; created: number; unassigned: number };

type NoticeContext = {
  notice: CreatedNotice | null;
  setNotice: (notice: CreatedNotice | null) => void;
};

const Context = createContext<NoticeContext>({ notice: null, setNotice: () => {} });

export function UnitsNoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<CreatedNotice | null>(null);
  return <Context.Provider value={{ notice, setNotice }}>{children}</Context.Provider>;
}

export const useUnitsNotice = () => useContext(Context).setNotice;

/** Над стояками только что созданного блока; фокус — на него: кнопка «Создать» исчезла. */
export function UnitsCreatedNotice({ blockId }: { blockId: string }) {
  const t = useTranslations("admin.complexes.units.generator");
  const { notice } = useContext(Context);
  const ref = useRef<HTMLDivElement>(null);
  const shown = notice?.blockId === blockId ? notice : null;
  useEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown]);
  if (!shown) return null;
  return (
    <div ref={ref} className="units-notice" tabIndex={-1}>
      <FormStatus tone="success">{t("created", { count: shown.created })}</FormStatus>
      {shown.unassigned > 0 ? (
        <FormStatus tone="notice">{t("createdUnassigned", { count: shown.unassigned })}</FormStatus>
      ) : null}
    </div>
  );
}
