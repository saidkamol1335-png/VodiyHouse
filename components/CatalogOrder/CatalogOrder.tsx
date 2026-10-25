"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { FormStatus } from "@/components/FormStatus";
import type { CatalogOrderResult } from "@/lib/admin/complexes/types";
import type { ContentErrorCode } from "@/lib/admin/developers/errors";
import type { FormAction } from "@/lib/admin/developers/types";
import { useMoveFocus, type MoveDirection } from "@/lib/ui/useMoveFocus";

type OrderItem = { id: string; name: string };

type CatalogOrderProps = {
  /** Опубликованные ЖК в нынешнем порядке каталога. */
  complexes: readonly OrderItem[];
  /** null — без облака (служебный стенд): порядок меняется только в браузере. */
  action: FormAction<CatalogOrderResult> | null;
};

/**
 * «Порядок в каталоге» (шаг 3.6, «Рекомендуемые» — порядок руководителя): стрелками, как блоки и
 * программы оплаты; каждая стрелка сохраняется сразу, отказ возвращает прежний порядок.
 */
export function CatalogOrder({ complexes, action }: CatalogOrderProps) {
  const t = useTranslations("admin.complexes.catalogOrder");
  const tErrors = useTranslations("admin.developers.errors");
  const [order, setOrder] = useState<readonly OrderItem[]>(complexes);
  const [moved, setMoved] = useState<{ id: string; direction: MoveDirection } | null>(null);
  const [error, setError] = useState<ContentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const forgetMove = useCallback(() => setMoved(null), []);
  if (complexes.length < 2) return null;
  const move = (index: number, direction: MoveDirection) => {
    const previous = order;
    const next = [...order];
    const target = direction === "up" ? index - 1 : index + 1;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setOrder(next);
    setMoved({ id: next[target]!.id, direction });
    if (!action) return;
    startTransition(async () => {
      const data = new FormData();
      for (const item of next) data.append("ids", item.id);
      const result = await action(data);
      setError(result.status === "error" ? result.error : null);
      if (result.status === "error") setOrder(previous);
    });
  };
  return (
    <AdminPanel title={t("title")} wide>
      <p className="catalog-order__lead">{t("lead")}</p>
      <ol className="catalog-order" aria-busy={pending || undefined}>
        {order.map((item, index) => (
          <OrderRow
            key={item.id}
            item={item}
            index={index}
            count={order.length}
            focusMove={moved?.id === item.id ? moved.direction : undefined}
            onMoveFocused={forgetMove}
            onMove={(direction) => move(index, direction)}
          />
        ))}
      </ol>
      {error ? <FormStatus tone="error">{tErrors(error)}</FormStatus> : null}
    </AdminPanel>
  );
}

type OrderRowProps = {
  item: OrderItem;
  index: number;
  count: number;
  focusMove: MoveDirection | undefined;
  onMoveFocused: () => void;
  onMove: (direction: MoveDirection) => void;
};

function OrderRow({ item, index, count, focusMove, onMoveFocused, onMove }: OrderRowProps) {
  const t = useTranslations("admin.complexes.catalogOrder");
  const [up, down] = useMoveFocus(focusMove, onMoveFocused);
  return (
    <li className="catalog-order__row">
      <span className="catalog-order__place">{index + 1}</span>
      <span className="catalog-order__name">{item.name}</span>
      <button ref={up} type="button" className="catalog-order__move" aria-label={t("up", { name: item.name })} disabled={index === 0} onClick={() => onMove("up")}>
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button ref={down} type="button" className="catalog-order__move" aria-label={t("down", { name: item.name })} disabled={index === count - 1} onClick={() => onMove("down")}>
        <ArrowDown size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
