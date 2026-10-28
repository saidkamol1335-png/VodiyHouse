import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ComplexPicker, FloorPlan, PickerUnit } from "@/lib/site/picker/records";
import { usePickerChoice } from "./usePickerChoice";

const image = { path: "complexes/x/y.png", width: 1600, height: 1200, blur: null, alt: null, focus: { x: 0.5, y: 0.5 } };
const plan: FloorPlan = { id: "p", blockId: "A", entrance: 1, floorFrom: 2, floorTo: 3, image, contours: [] };
const picker: ComplexPicker = { facade: image, blocks: [{ id: "A", contour: [[0, 0], [1, 0], [1, 1]] }], plans: [plan] };

const unit = (id: string, floor: number, status: PickerUnit["status"]): PickerUnit => ({
  id,
  entrance: 1,
  floor,
  position: Number(id.slice(1)),
  number: id,
  layoutId: null,
  rooms: 1,
  area: 40,
  status,
  price: status === "free" ? 30000 : null,
  currency: "USD",
});

describe("выбор квартиры: состояние раздела", () => {
  it("этаж по умолчанию запоминается: новые счётчики опроса план не переводят", () => {
    const first = { A: [unit("u1", 2, "free"), unit("u2", 2, "free"), unit("u3", 3, "free")] };
    const { result, rerender } = renderHook(({ units }) => usePickerChoice(picker, units), { initialProps: { units: first } });
    act(() => result.current.pickBlock("A"));
    expect(result.current.floor).toBe(2);
    // Опрос: на 3-м этаже освободилось больше — выбор остаётся на 2-м.
    rerender({ units: { A: [unit("u1", 2, "sold"), unit("u2", 2, "free"), unit("u3", 3, "free"), unit("u4", 3, "free")] } });
    expect(result.current.floor).toBe(2);
    expect(result.current.entrance).toBe(1);
  });

  it("квартира, которую забронировали при открытой панели, остаётся выбранной — занятой", () => {
    const { result, rerender } = renderHook(({ units }) => usePickerChoice(picker, units), {
      initialProps: { units: { A: [unit("u1", 2, "free")] } },
    });
    act(() => result.current.pickBlock("A"));
    act(() => result.current.pickUnit("u1"));
    expect(result.current.unit?.status).toBe("free");
    rerender({ units: { A: [unit("u1", 2, "reserved")] } });
    expect(result.current.unit?.status).toBe("reserved");
    act(() => result.current.pickFloor(3));
    expect(result.current.unit).toBeNull();
  });
});
