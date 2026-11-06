import { cleanup, render, screen, within } from "@testing-library/react";
import { filterVisibility } from "@vh/shared/filterArchive";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FILTER } from "@/lib/site/catalog/filter";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import messages from "@/messages/uz.json";
import { CatalogFilter } from "./CatalogFilter";

afterEach(cleanup);
// Ряд пилюль следит за шириной (useStripScroll); в jsdom ResizeObserver нет.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

const block = (year: number, finishing: string) => ({
  id: `b${year}`,
  name: "A",
  currency: "USD",
  buildStatus: "building",
  deadline: { year, quarter: 4 },
  floorsTotal: 9,
  finishing: {
    slug: finishing,
    name: { ru: finishing, uz: finishing === "white-box" ? "White box" : "Qora suvoq" },
  },
  offers: [],
});

const CATALOG = {
  rate: null,
  developers: [
    { id: "d1", slug: "fsq", name: "FSQ", programs: [] },
    { id: "d2", slug: "ukasset", name: "UKASSET", programs: [] },
  ],
  complexes: [
    {
      location: { slug: "fargona", name: { ru: "Фергана", uz: "Farg‘ona" } },
      blocks: [block(2027, "white-box"), block(2028, "qora")],
    },
    { location: { slug: "margilon", name: { ru: "Маргилан", uz: "Marg‘ilon" } }, blocks: [] },
  ],
} as unknown as SiteCatalog;

function renderFilter(archived: string[], filter = NO_FILTER) {
  render(
    <NextIntlClientProvider locale="uz" messages={messages}>
      <CatalogFilter
        catalog={CATALOG}
        filter={filter}
        onChange={() => {}}
        found={3}
        open={false}
        onClose={() => {}}
        onShow={() => {}}
        visibility={filterVisibility(archived)}
      />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("complementary", { name: "Filtrlar" });
}

describe("CatalogFilter · архив кнопок", () => {
  it("без архива — все блоки и кнопки, как в мокапе", () => {
    const filter = renderFilter([]);
    for (const title of [
      "Xonalar",
      "Kvartira narxi, $",
      "To‘lov usuli",
      "Topshirish muddati",
      "Pardozlash",
    ]) {
      expect(within(filter).getByText(title)).toBeTruthy();
    }
    expect(within(filter).getByRole("button", { name: "Ipoteka" })).toBeTruthy();
    expect(within(filter).getByRole("button", { name: "2028 gacha" })).toBeTruthy();
  });

  it("скрытые кнопки не рисуются, соседние — на месте", () => {
    const filter = renderFilter([
      "payment:mort",
      "rooms:0",
      "deadline:2028",
      "finishing:qora",
      "developer:fsq",
      "location:margilon",
    ]);
    expect(within(filter).queryByRole("button", { name: "Ipoteka" })).toBeNull();
    expect(within(filter).getByRole("button", { name: "Bank orqali" })).toBeTruthy();
    expect(within(filter).queryByRole("button", { name: "Studiya" })).toBeNull();
    expect(within(filter).getByRole("button", { name: "4+" })).toBeTruthy();
    expect(within(filter).queryByRole("button", { name: "2028 gacha" })).toBeNull();
    expect(within(filter).getByRole("button", { name: "2027 gacha" })).toBeTruthy();
    expect(within(filter).queryByRole("button", { name: "Qora suvoq" })).toBeNull();
    expect(within(filter).getByRole("button", { name: "White box" })).toBeTruthy();
    const developer = within(filter).getByLabelText("Quruvchi");
    expect(within(developer).queryByRole("option", { name: "FSQ" })).toBeNull();
    expect(within(developer).getByRole("option", { name: "UKASSET" })).toBeTruthy();
    const location = within(filter).getByLabelText("Shahar va tuman");
    expect(within(location).queryByRole("option", { name: "Marg‘ilon" })).toBeNull();
  });

  it("выбранная кнопка из архива видна (ссылка рекламы или квиза): её можно снять", () => {
    const filter = renderFilter(["payment:mort", "section:developer"], {
      ...NO_FILTER,
      payments: ["mort"],
      developers: ["fsq"],
    });
    expect(within(filter).getByRole("button", { name: "Ipoteka" })).toBeTruthy();
    const developer = within(filter).getByLabelText("Quruvchi");
    expect(within(developer).getByRole("option", { name: "FSQ" })).toBeTruthy();
    expect(within(developer).queryByRole("option", { name: "UKASSET" })).toBeNull();
    expect(within(filter).getByRole("button", { name: "Tozalash" })).toBeTruthy();
  });

  it("скрытый блок пропадает целиком, а блок без кнопок — тоже", () => {
    const filter = renderFilter([
      "section:price",
      "section:developer",
      "payment:full",
      "payment:inst",
      "payment:bank",
      "payment:mort",
      "deadline:built",
      "deadline:2027",
      "deadline:2028",
    ]);
    expect(within(filter).queryByText("Kvartira narxi, $")).toBeNull();
    expect(within(filter).queryByLabelText("Quruvchi")).toBeNull();
    expect(within(filter).queryByText("To‘lov usuli")).toBeNull();
    // Остался бы один «Istalgan» — блока срока нет.
    expect(within(filter).queryByText("Topshirish muddati")).toBeNull();
    expect(within(filter).getByText("Xonalar")).toBeTruthy();
    expect(within(filter).getByRole("button", { name: /ta TJMni ko‘rsatish/ })).toBeTruthy();
  });
});
