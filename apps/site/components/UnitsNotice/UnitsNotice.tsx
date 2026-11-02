"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { FormStatus } from "@/components/FormStatus";
import type { StaleAvailability } from "@/lib/admin/units/useLayoutAvailability";

// «Создано: N квартир» после генератора, «Список блока удалён» (12.5) и «экран устарел» у Н7
// (12.6). Настоящее действие сбрасывает тег ЖК, страница тут же перерисовывается — генератор
// сменяется списком или список генератором, и ответ ушёл бы вместе с ними. Поэтому он хранится
// выше (провайдер стоит над переключением «генератор ↔ список») и показывается над обоими.

export type UnitsNotice =
  | { kind: "created"; blockId: string; created: number; unassigned: number }
  | { kind: "deleted"; blockId: string; name: string; deleted: number }
  /** Н7 ответил «экран устарел» — после перечитывания строки или всей панели уже нет. */
  | { kind: "stale"; blockId: string; reason: StaleAvailability };

type NoticeContext = {
  notice: UnitsNotice | null;
  setNotice: (notice: UnitsNotice | null) => void;
};

const Context = createContext<NoticeContext>({ notice: null, setNotice: () => {} });

type ProviderProps = {
  /** Блок на экране: другой — уведомление прежнего уходит. Вернувшись, «Список удалён» не спрятал
   *  бы список, который тем временем создали снова (провайдер переживает смену ?blok=). */
  blockId: string | null;
  children: ReactNode;
};

export function UnitsNoticeProvider({ blockId, children }: ProviderProps) {
  const [state, setState] = useState<{ blockId: string | null; notice: UnitsNotice | null }>({
    blockId,
    notice: null,
  });
  // Сброс при смене пропса — в рендере (как советует React), а не эффектом: эффект в StrictMode
  // запускается дважды и стёр бы и свежее уведомление.
  if (state.blockId !== blockId) setState({ blockId, notice: null });
  const setNotice = useCallback(
    (notice: UnitsNotice | null) => setState((current) => ({ ...current, notice })),
    [],
  );
  const value = useMemo(() => ({ notice: state.notice, setNotice }), [state.notice, setNotice]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useUnitsNotice = () => useContext(Context).setNotice;

/** Список блока удалён на этом экране — блок показывает только уведомление (стенд, переход). */
export const useListRemoved = (blockId: string) => {
  const { notice } = useContext(Context);
  return notice?.kind === "deleted" && notice.blockId === blockId;
};

type UnitsListNoticeProps = {
  blockId: string;
  /** Над генератором «Создано» не нужно — у генератора свой ответ (пока страница не сменилась). */
  createdToo: boolean;
};

/** Над генератором или списком блока; фокус — на него: кнопка, которую нажали, исчезла. */
export function UnitsListNotice({ blockId, createdToo }: UnitsListNoticeProps) {
  const { notice } = useContext(Context);
  const ref = useRef<HTMLDivElement>(null);
  const mine = notice?.blockId === blockId ? notice : null;
  const shown = mine && (createdToo || mine.kind !== "created") ? mine : null;
  useEffect(() => {
    if (shown) ref.current?.focus();
  }, [shown]);
  if (!shown) return null;
  return (
    <div ref={ref} className="units-notice" tabIndex={-1}>
      <NoticeText notice={shown} />
    </div>
  );
}

function NoticeText({ notice }: { notice: UnitsNotice }) {
  const t = useTranslations("admin.complexes.units");
  switch (notice.kind) {
    case "deleted":
      return (
        <FormStatus tone="success">
          {t("removeList.done", { name: notice.name, count: notice.deleted })}
        </FormStatus>
      );
    case "stale":
      return (
        <FormStatus tone="notice">
          {t(
            notice.reason === "listExists" ? "availability.staleList" : "availability.staleLayout",
          )}
        </FormStatus>
      );
    case "created":
      return (
        <>
          <FormStatus tone="success">
            {t("generator.created", { count: notice.created })}
          </FormStatus>
          {notice.unassigned > 0 ? (
            <FormStatus tone="notice">
              {t("generator.createdUnassigned", { count: notice.unassigned })}
            </FormStatus>
          ) : null}
        </>
      );
  }
}
