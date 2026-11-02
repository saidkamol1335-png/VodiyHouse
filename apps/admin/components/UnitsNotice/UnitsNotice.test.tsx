import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnitsGenerator } from "@/components/UnitsGenerator";
import type { CreateBlockUnitsResult } from "@/lib/admin/units/types";
import ru from "@/messages/ru.json";
import {
  UnitsListNotice,
  UnitsNoticeProvider,
  useListRemoved,
  useUnitsNotice,
} from "./UnitsNotice";

// Настоящий кабинет: после «Создать» страница перерисовывается уже со списком — генератор
// исчезает, ответ должен показаться над стояками. Здесь перерисовку заменяет rerender.

const LAYOUTS = [{ id: "l1", rooms: 1, area: 42.5, available: true, priceFrom: null }];

function Tab({
  listed,
  action,
}: {
  listed: boolean;
  action: () => Promise<CreateBlockUnitsResult>;
}) {
  return (
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitsNoticeProvider blockId="b1">
        {listed ? (
          <UnitsListNotice blockId="b1" createdToo />
        ) : (
          <UnitsGenerator
            blockId="b1"
            floors={5}
            layouts={LAYOUTS}
            layoutsHref="/planirovki"
            published={false}
            action={action}
          />
        )}
      </UnitsNoticeProvider>
    </NextIntlClientProvider>
  );
}

/** Блок со списком: уведомление сверху, ниже — список или «удалён». */
function BlockWithList({ blockId }: { blockId: string }) {
  const setNotice = useUnitsNotice();
  const removed = useListRemoved(blockId);
  return (
    <>
      <UnitsListNotice blockId={blockId} createdToo />
      {removed ? null : <p>Список блока {blockId}</p>}
      <button
        type="button"
        onClick={() => setNotice({ kind: "deleted", blockId, name: "A", deleted: 3 })}
      >
        Удалить
      </button>
    </>
  );
}

function Switch({ blockId }: { blockId: string }) {
  return (
    <NextIntlClientProvider locale="ru" messages={ru}>
      <UnitsNoticeProvider blockId={blockId}>
        <BlockWithList blockId={blockId} />
      </UnitsNoticeProvider>
    </NextIntlClientProvider>
  );
}

describe("«Список блока удалён» и переключение блоков", () => {
  afterEach(cleanup);

  it("другой блок и обратно — уведомления нет, список (созданный снова) виден", () => {
    const { rerender } = render(<Switch blockId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(screen.queryByText("Список блока b1")).toBeNull();
    expect(screen.getByText(/Список блока A удалён/)).toBeTruthy();
    rerender(<Switch blockId="b2" />);
    rerender(<Switch blockId="b1" />);
    expect(screen.getByText("Список блока b1")).toBeTruthy();
    expect(screen.queryByText(/удалён/)).toBeNull();
  });
});

describe("ответ генератора после перерисовки страницы", () => {
  afterEach(cleanup);

  it("«Создано» и квартиры без планировки — над стояками, фокус на ответе", async () => {
    const action = vi.fn(async (): Promise<CreateBlockUnitsResult> => ({
      status: "done",
      created: 32,
      unassigned: 32,
    }));
    const { rerender } = render(<Tab listed={false} action={action} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Создать 32 квартиры" })),
    );
    expect(action).toHaveBeenCalledOnce();
    rerender(<Tab listed action={action} />);
    expect(screen.getByText("Создано: 32 квартиры")).toBeTruthy();
    expect(screen.getByText(/Без планировки: 32 квартиры/)).toBeTruthy();
    expect(document.activeElement?.className).toBe("units-notice");
  });

  it("отказ ничего не оставляет над стояками", async () => {
    const action = vi.fn(async (): Promise<CreateBlockUnitsResult> => ({
      status: "error",
      error: "listExists",
      field: null,
      broken: [],
    }));
    const { rerender } = render(<Tab listed={false} action={action} />);
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Создать 32 квартиры" })),
    );
    rerender(<Tab listed action={action} />);
    expect(screen.queryByText(/Создано/)).toBeNull();
  });
});
