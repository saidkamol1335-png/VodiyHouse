"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { Field } from "@/components/Field";
import { blockNameConfirmed } from "@/lib/admin/units/parse";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";

type UnitsListDeleteProps = {
  /** id обёртки: «К «Удалить список блока»» из массовой панели прокручивает к ней. */
  id?: string;
  blockName: string;
  count: number;
  edit: UnitsEditControl;
};

/**
 * «Удалить список блока» (Н4) — свёрнутая опасная зона внизу блока: ввод названия блока (регистр и
 * A / А — любые), затем генератор снова доступен. Список удалил кто-то ещё — страница перечитывается.
 */
export function UnitsListDelete({ id, blockName, count, edit }: UnitsListDeleteProps) {
  const t = useTranslations("admin.complexes.units.removeList");
  const [open, setOpen] = useState(false);
  // «Отмена» — фокус обратно на кнопку опасной зоны, когда она появится снова.
  const back = useRef(false);
  const opener = (element: HTMLButtonElement | null) => {
    if (!element || !back.current) return;
    back.current = false;
    element.focus();
  };
  return (
    <div
      id={id}
      className={open ? "units-list-delete units-list-delete--open" : "units-list-delete"}
    >
      {open ? (
        <DeleteListForm
          blockName={blockName}
          count={count}
          edit={edit}
          onCancel={() => {
            back.current = true;
            setOpen(false);
          }}
        />
      ) : (
        <Button
          ref={opener}
          variant="danger"
          size="sm"
          onClick={() => setOpen(true)}
          className="units-list-delete__open"
        >
          {t("open")}
        </Button>
      )}
    </div>
  );
}

function DeleteListForm({
  blockName,
  count,
  edit,
  onCancel,
}: UnitsListDeleteProps & { onCancel: () => void }) {
  const t = useTranslations("admin.complexes.units.removeList");
  const tErrors = useTranslations("admin.developers.errors");
  const id = useId();
  const { typed, setTyped, reply, pending, submit } = useListDelete(edit);
  return (
    <form
      className="units-list-delete__form"
      aria-label={t("title", { name: blockName })}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="units-list-delete__title">{t("title", { name: blockName })}</p>
      <p className="units-list-delete__lead">{t("lead", { count })}</p>
      <Field
        id={id}
        label={t("confirm", { name: blockName })}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        value={typed}
        error={reply?.error === "confirmName" ? tErrors("confirmName") : undefined}
        onChange={(event) => setTyped(event.target.value)}
      />
      {reply && reply.error !== "confirmName" ? <ComplexSaveFeedback state={reply} /> : null}
      <DeleteListActions
        pending={pending}
        ready={blockNameConfirmed(typed, blockName)}
        onCancel={onCancel}
      />
    </form>
  );
}

/** Название блока и отправка; список удалил кто-то ещё («не найдено») — страница перечитывается. */
function useListDelete(edit: UnitsEditControl) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const { reply, pending, send } = useEditRequest();
  const submit = async () => {
    const result = await send((shown) => edit.removeList(typed, shown));
    if (result?.error === "notFound") router.refresh();
  };
  return { typed, setTyped, reply, pending, submit };
}

type DeleteListActionsProps = { pending: boolean; ready: boolean; onCancel: () => void };

/** «Отмена» и «Удалить список»: удалить можно, когда название блока введено верно. */
function DeleteListActions({ pending, ready, onCancel }: DeleteListActionsProps) {
  const t = useTranslations("admin.complexes.units.removeList");
  const submit = useRefocusAfter(pending);
  return (
    <div className="units-list-delete__actions">
      <Button variant="ghost" onClick={onCancel} className="units-list-delete__action">
        {t("cancel")}
      </Button>
      <Button
        ref={submit}
        type="submit"
        variant="danger"
        pending={pending}
        disabled={!ready}
        className="units-list-delete__action"
      >
        {pending ? t("pending") : t("submit")}
      </Button>
    </div>
  );
}
