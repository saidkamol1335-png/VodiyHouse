import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UnitsGenerator } from "@/components/UnitsGenerator";
import type { CreateBlockUnitsResult } from "@/lib/admin/units/types";
import ru from "@/messages/ru.json";
import { UnitsCreatedNotice, UnitsNoticeProvider } from "./UnitsNotice";

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
      <UnitsNoticeProvider>
        {listed ? (
          <UnitsCreatedNotice blockId="b1" />
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
