"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FormStatus } from "@/components/FormStatus";
import type { UnitsListStore } from "@/lib/admin/units/useUnitsList";

/** Список прочитан пустым, а страница говорила, что он есть: его удалили — страница устарела. */
export function ListGone() {
  const t = useTranslations("admin.complexes.units.list");
  const router = useRouter();
  return (
    <div className="units-block__failed">
      <FormStatus tone="notice">{t("gone")}</FormStatus>
      <button type="button" className="units-block__retry" onClick={() => router.refresh()}>
        {t("refreshPage")}
      </button>
    </div>
  );
}

type BlockReadStateProps = {
  error: UnitsListStore["state"]["readError"];
  reading: boolean;
  retry: () => Promise<boolean>;
  /** Прежний список на экране — не обновился. */
  stale?: boolean;
  /** Удачное «Повторить» с фокусом на кнопке: она уходит вместе с отказом — фокус переставит блок. */
  onRecovered?: () => void;
};

/** Первое чтение, его отказ с «Повторить» или «список не обновился — показан прежний». */
export function BlockReadState({
  error,
  reading,
  retry,
  stale = false,
  onRecovered,
}: BlockReadStateProps) {
  const t = useTranslations("admin.complexes.units");
  const tErrors = useTranslations("admin.developers.errors");
  const retryKeepingFocus = async (button: HTMLButtonElement) => {
    const focused = document.activeElement === button;
    if ((await retry()) && focused) onRecovered?.();
  };
  if (!error)
    return (
      <p className="units-block__loading" role="status" aria-busy={reading}>
        {t("loading")}
      </p>
    );
  return (
    <div className="units-block__failed">
      <FormStatus tone={stale ? "notice" : "error"}>
        {stale ? t("list.refreshFailed") : t("list.loadFailed")}{" "}
        {/* Читают все сотрудники: «только руководитель» ввело бы в заблуждение — доступ отключили. */}
        {error === "forbidden" ? t("list.bar.forbidden") : tErrors(error)}
      </FormStatus>
      <button
        type="button"
        className="units-block__retry"
        aria-disabled={reading}
        onClick={reading ? undefined : (event) => void retryKeepingFocus(event.currentTarget)}
      >
        {t("list.retry")}
      </button>
    </div>
  );
}
