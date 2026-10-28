"use client";

import { useState } from "react";
import { bestEntrance, bestFloor, blockFloors, floorEntrances, planFor } from "@/lib/site/picker/model";
import type { ComplexPicker, PickerUnit } from "@/lib/site/picker/records";

type Choice = { blockId: string | null; floor: number | null; entrance: number | null; unitId: string | null };

const NOTHING: Choice = { blockId: null, floor: null, entrance: null, unitId: null };

/**
 * Что выбрано в разделе: блок → этаж → подъезд → квартира. Этаж и подъезд по умолчанию — где
 * свободных больше (мокап), и они запоминаются, как только квартиры пришли: опрос раз в 15 с не
 * переводит план на другой этаж под рукой посетителя. Смена этажа сбрасывает подъезд, смена
 * подъезда — квартиру. Квартиру, которую забронировали, пока открыта панель, панель показывает
 * занятой, а не исчезает вместе с расчётом.
 */
export function usePickerChoice(picker: ComplexPicker, byBlock: Record<string, PickerUnit[]>) {
  const [choice, setChoice] = useState<Choice>(NOTHING);
  const blockId = choice.blockId;
  const loaded = Boolean(blockId && byBlock[blockId]);
  const units = (blockId && byBlock[blockId]) || [];
  const floors = blockId ? blockFloors(picker.plans, blockId, units) : [];
  const floor = choice.floor ?? bestFloor(floors);
  const entrances = blockId && floor !== null ? floorEntrances(picker.plans, blockId, floor, units) : [];
  const entrance = choice.entrance ?? bestEntrance(entrances);
  // Запомнить этаж и подъезд по умолчанию (во время рендера, как при смене пропсов): дальше
  // счётчики меняются, а выбор — нет.
  if (loaded && (choice.floor !== floor || (entrance !== null && choice.entrance !== entrance))) {
    setChoice({ ...choice, floor, entrance });
  }
  const set = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return {
    blockId,
    units,
    loading: Boolean(blockId) && !loaded,
    floors,
    floor,
    entrances,
    entrance,
    plan: blockId && floor !== null ? planFor(picker.plans, blockId, floor, entrance) : null,
    unit: units.find((item) => item.id === choice.unitId) ?? null,
    pickBlock: (next: string) => setChoice({ ...NOTHING, blockId: next }),
    back: () => setChoice(NOTHING),
    pickFloor: (next: number) => set({ floor: next, entrance: null, unitId: null }),
    pickEntrance: (next: number | null) => set({ entrance: next, unitId: null }),
    pickUnit: (next: string | null) => set({ unitId: next }),
  };
}

export type PickerChoice = ReturnType<typeof usePickerChoice>;
