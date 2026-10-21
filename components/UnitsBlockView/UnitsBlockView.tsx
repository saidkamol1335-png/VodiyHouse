"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { FormStatus } from "@/components/FormStatus";
import { UnitsCreatedNotice } from "@/components/UnitsNotice";
import { UnitsList } from "@/components/UnitsList";
import { UnitsRisers } from "@/components/UnitsRisers";
import { UnitsUndoBar } from "@/components/UnitsUndoBar";
import { unitRowContext } from "@/lib/admin/units/rowView";
import type {
  SaveRisersInput,
  SaveRisersResult,
  UnitsAction,
  UnitsBlock,
  UnitsFinishing,
  UnitsLayout,
  UnitsListActions,
} from "@/lib/admin/units/types";
import { useUnitStatus } from "@/lib/admin/units/useUnitStatus";
import { useUnitsList, type UnitsListStore } from "@/lib/admin/units/useUnitsList";
import { readyBlockView } from "@/lib/admin/units/view";
import type { UnitRecord, UnitStatus } from "@/lib/units";

type UnitsBlockViewProps = {
  block: UnitsBlock;
  layouts: readonly UnitsLayout[];
  finishings: readonly UnitsFinishing[];
  actions: UnitsListActions;
  saveRisersAction: UnitsAction<SaveRisersInput, SaveRisersResult>;
  /** Имя сотрудника — «только что · имя» у сменённой строки без нового чтения. */
  viewerName: string | null;
};

/**
 * Блок со списком (Н6): список читается здесь, а не страницей (12.4), стояки собираются из
 * прочитанного; свёрнутые «Стояки» — над списком. Полоса «Отменить» — вне контейнера списка:
 * container query делает его опорой для position: fixed.
 */
export function UnitsBlockView(props: UnitsBlockViewProps) {
  const { block, actions } = props;
  const t = useTranslations("admin.complexes.units");
  const store = useUnitsList({ blockId: block.id, read: actions.read, expectList: true });
  const status = useUnitStatus(store, {
    blockId: block.id,
    blockName: block.name,
    actions: actions.status,
    viewerName: props.viewerName,
  });
  const { change } = status;
  const onStatus = useCallback((unit: UnitRecord, to: UnitStatus) => change([unit], to), [change]);
  const count = store.state.base?.length ?? block.unitCount;
  return (
    <div className="units-block">
      <p className="units-block__listed">
        <b>{t("blockName", { name: block.name })}</b> · {t("listed", { count })}
      </p>
      <UnitsCreatedNotice blockId={block.id} />
      <BlockBody {...props} store={store} onStatus={actions.status ? onStatus : null} />
      {status.bar ? <div className="units-block__spacer" aria-hidden="true" /> : null}
      <UnitsUndoBar control={status} blockId={block.id} />
    </div>
  );
}

type BodyProps = UnitsBlockViewProps & {
  store: UnitsListStore;
  onStatus: ((unit: UnitRecord, to: UnitStatus) => void) | null;
};

function BlockBody({ block, layouts, finishings, saveRisersAction, store, onStatus }: BodyProps) {
  const { base, readError, reading } = store.state;
  const ready = useMemo(
    () => (base ? readyBlockView(base, block.floorsTotal) : null),
    [base, block.floorsTotal],
  );
  const rowContext = useMemo(
    () => unitRowContext(block, layouts, finishings),
    [block, layouts, finishings],
  );
  if (base === null) return <ReadState error={readError} reading={reading} retry={store.reload} />;
  if (base.length === 0) return <ListGone />;
  return (
    <>
      {ready ? (
        <UnitsRisers
          key={block.id}
          blockId={block.id}
          ready={ready}
          layouts={layouts}
          action={saveRisersAction}
          onSaved={store.reload}
        />
      ) : null}
      {readError ? (
        <ReadState error={readError} reading={reading} retry={store.reload} stale />
      ) : null}
      <UnitsList
        blockName={block.name}
        units={store.units}
        sticky={store.state.sticky}
        rowContext={rowContext}
        onFilterChange={() => store.dispatch({ type: "filterChanged" })}
        onStatus={onStatus}
      />
    </>
  );
}

/** Список прочитан пустым, а страница говорила, что он есть: его удалили — страница устарела. */
function ListGone() {
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

type ReadStateProps = {
  error: UnitsListStore["state"]["readError"];
  reading: boolean;
  retry: () => Promise<boolean>;
  /** Прежний список на экране — не обновился. */
  stale?: boolean;
};

/** Первое чтение, его отказ с «Повторить» или «список не обновился — показан прежний». */
function ReadState({ error, reading, retry, stale = false }: ReadStateProps) {
  const t = useTranslations("admin.complexes.units");
  const tErrors = useTranslations("admin.developers.errors");
  if (!error)
    return (
      <p className="units-block__loading" role="status" aria-busy={reading}>
        {t("loading")}
      </p>
    );
  return (
    <div className="units-block__failed">
      <FormStatus tone={stale ? "notice" : "error"}>
        {stale ? t("list.refreshFailed") : t("list.loadFailed")} {tErrors(error)}
      </FormStatus>
      <button
        type="button"
        className="units-block__retry"
        aria-disabled={reading}
        onClick={reading ? undefined : () => void retry()}
      >
        {t("list.retry")}
      </button>
    </div>
  );
}
