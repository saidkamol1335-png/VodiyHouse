"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { UnitAddForm } from "@/components/UnitAddForm";
import { UnitsBulkBar } from "@/components/UnitsBulkBar";
import { UnitsDock } from "@/components/UnitsDock";
import { UnitsList } from "@/components/UnitsList";
import { UnitsListDelete } from "@/components/UnitsListDelete";
import { useListRemoved } from "@/components/UnitsNotice";
import { UnitsRisers } from "@/components/UnitsRisers";
import { UnitsUndoBar } from "@/components/UnitsUndoBar";
import { UnitsEditContext } from "@/lib/admin/units/editContext";
import type { SaveRisersInput, SaveRisersResult, UnitsAction } from "@/lib/admin/units/types";
import { useFocusAfterRender } from "@/lib/ui/useFocusAfterRender";
import { BLOCK_PLAN_LIMITS } from "@/lib/units";
import { BlockReadState, ListGone } from "./BlockReadState";
import { UnitsBlockHead } from "./UnitsBlockHead";
import { useUnitsBlock, type UnitsBlockParams, type UnitsBlockState } from "./useUnitsBlock";

type UnitsBlockViewProps = UnitsBlockParams & {
  /** null — «Стояков» нет (менеджер, Н2): планировки квартир правит руководитель. */
  saveRisersAction: UnitsAction<SaveRisersInput, SaveRisersResult> | null;
  /** ЖК на сайте: удаление предупреждает, что сайт перестанет показывать квартиры. */
  published: boolean;
};

/** ids: «Удалить список блока» (сюда ведёт массовая панель) и сводка списка (цель фокуса). */
type WithState = UnitsBlockViewProps & {
  state: UnitsBlockState;
  ids: { danger: string; summary: string };
};

/**
 * Блок со списком (Н6): список читается здесь, а не страницей (12.4), стояки собираются из
 * прочитанного; «+ Квартира», свёрнутые «Стояки», список, опасная зона «Удалить список блока»;
 * внизу экрана — полоса «Отменить» и массовая панель (вне контейнера списка: container query
 * делает его опорой для position: fixed).
 */
export function UnitsBlockView(props: UnitsBlockViewProps) {
  // Список удалили на этом экране — над блоком уже уведомление, а генератор придёт со страницей.
  if (useListRemoved(props.block.id)) return null;
  return <BlockContent {...props} />;
}

function BlockContent(props: UnitsBlockViewProps) {
  const state = useUnitsBlock(props);
  const ids = { danger: useId(), summary: useId() };
  const { base } = state.store.state;
  const docked = state.status.bar !== null || state.selection.selected.length > 0;
  return (
    <div className="units-block" data-units-dock-host>
      <BlockHeadAndAdd {...props} state={state} ids={ids} />
      <BlockBody {...props} state={state} ids={ids} />
      {state.edit && props.actions.edit?.removeList && base && base.length > 0 ? (
        <UnitsListDelete
          id={ids.danger}
          blockName={props.block.name}
          count={base.length}
          edit={state.edit}
        />
      ) : null}
      {docked ? <div className="units-block__spacer" aria-hidden="true" /> : null}
      <UnitsDock>
        <UnitsUndoBar control={state.status} blockId={props.block.id} />
        <BulkBar {...props} state={state} ids={ids} />
      </UnitsDock>
    </div>
  );
}

function BulkBar({ state, actions, ids, ...props }: WithState) {
  const summary = ids.summary;
  // Без прокрутки: фокус лишь не теряется, страница остаётся там, где работали.
  const focusSummary = useCallback(
    () => document.getElementById(summary)?.focus({ preventScroll: true }),
    [summary],
  );
  return (
    <UnitsBulkBar
      selection={state.selection}
      visible={state.view.visible}
      total={state.store.state.base?.length ?? 0}
      status={actions.status ? state.status : null}
      edit={state.edit}
      can={{
        price: Boolean(actions.edit?.price),
        finishing: Boolean(actions.edit?.finishing),
        remove: Boolean(actions.edit?.remove),
      }}
      block={props.block}
      layouts={props.layouts}
      finishings={props.finishings}
      published={props.published}
      onToWhole={() => toDangerZone(ids.danger)}
      onCleared={focusSummary}
    />
  );
}

function toDangerZone(id: string) {
  const zone = document.getElementById(id);
  zone?.scrollIntoView({ block: "center" });
  zone?.querySelector<HTMLElement>("button")?.focus();
}

/** «Блок A · список из N» и «+ Квартира»: форма над стояками, не закрывается после «Добавить». */
function BlockHeadAndAdd({ block, layouts, actions, state }: WithState) {
  const [adding, setAdding] = useState(false);
  const addId = useId();
  const { base } = state.store.state;
  const canAdd = Boolean(actions.edit?.add && state.edit) && base !== null && base.length > 0;
  const blocked =
    block.floorsTotal === null
      ? ("noFloors" as const)
      : (base?.length ?? 0) >= BLOCK_PLAN_LIMITS.totalUnits
        ? ("limit" as const)
        : null;
  return (
    <>
      <UnitsBlockHead
        name={block.name}
        count={base?.length ?? block.unitCount}
        add={
          canAdd ? { id: addId, open: adding, blocked, onToggle: () => setAdding(!adding) } : null
        }
      />
      {adding && canAdd && !blocked && state.edit && base ? (
        <UnitAddForm
          units={base}
          layouts={layouts}
          floorsTotal={block.floorsTotal!}
          risers={state.ready?.risers ?? []}
          edit={state.edit}
          onClose={() => {
            setAdding(false);
            // Фокус — на «+ Квартира», а не на body: формы под ним больше нет.
            document.getElementById(addId)?.focus();
          }}
        />
      ) : null}
    </>
  );
}

/** Первое чтение и «Повторить»: удачный повтор с фокусом на кнопке — фокус на сводку списка. */
function useBlockRead(store: UnitsBlockState["store"], summaryId: string) {
  const focusAfterRead = useFocusAfterRender();
  const { readError, reading } = store.state;
  return {
    error: readError,
    reading,
    retry: store.reload,
    onRecovered: () => focusAfterRead(summaryId),
  };
}

function BlockBody({ block, layouts, finishings, saveRisersAction, state, ids }: WithState) {
  const { store, edit, selection, dirty, ready, onStatus } = state;
  const { base, readError } = store.state;
  const editContext = useMemo(
    () => (edit && base ? { edit, block, layouts, finishings, units: base, dirty } : null),
    [edit, base, block, layouts, finishings, dirty],
  );
  const read = useBlockRead(store, ids.summary);
  if (base === null) return <BlockReadState {...read} />;
  if (base.length === 0) return <ListGone />;
  return (
    <>
      {ready && saveRisersAction ? (
        <UnitsRisers
          key={block.id}
          blockId={block.id}
          ready={ready}
          reads={store.state.reads}
          layouts={layouts}
          action={saveRisersAction}
          onSaved={store.reload}
        />
      ) : null}
      {readError ? <BlockReadState {...read} stale /> : null}
      <UnitsEditContext.Provider value={editContext}>
        <UnitsList
          blockName={block.name}
          summaryId={ids.summary}
          rowContext={state.rowContext}
          view={state.view}
          selection={onStatus || edit ? selection : null}
          canEdit={edit !== null}
          onStatus={onStatus}
        />
      </UnitsEditContext.Provider>
    </>
  );
}
