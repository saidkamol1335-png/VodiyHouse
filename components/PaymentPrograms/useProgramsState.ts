"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import type { ToastMessage } from "@/components/ActionToast";
import { programFullName, type ProgramsT } from "@/components/ProgramCard/cardText";
import type {
  ProgramActionResult,
  ProgramActions,
  ProgramItem,
  ProgramPanel,
  ProgramsScreenData,
} from "@/lib/admin/programs/types";
import { useSyncedState } from "@/lib/ui/useSyncedState";

// Состояние экрана «Программы оплаты»: панели и курс — от сервера; ответ действия меняет экран
// сразу (и на стенде без базы), новые пропсы после перерисовки страницы снова главнее.

export const formOf = (fields: Record<string, string | readonly string[]>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of typeof value === "string" ? [value] : value) form.append(name, item);
  }
  return form;
};

function usePanels(source: readonly ProgramPanel[]) {
  const [panels, setPanels] = useSyncedState(source);
  const updatePanel = (developerId: string, change: (panel: ProgramPanel) => ProgramPanel) =>
    setPanels((list) => list.map((panel) => (panel.id === developerId ? change(panel) : panel)));
  const putItem = (item: ProgramItem) =>
    updatePanel(item.developerId, (panel) => ({
      ...panel,
      programs: panel.programs.some((existing) => existing.id === item.id)
        ? panel.programs.map((existing) => (existing.id === item.id ? item : existing))
        : [...panel.programs, item],
    }));
  const dropItem = (developerId: string, id: string) =>
    updatePanel(developerId, (panel) => ({
      ...panel,
      programs: panel.programs.filter((item) => item.id !== id),
    }));
  return { panels, updatePanel, putItem, dropItem };
}

export function useToast() {
  const tAdmin = useTranslations("admin");
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const notify = (tone: ToastMessage["tone"], text: string) =>
    setToast({ id: Date.now(), tone, text });
  const closeToast = useCallback(() => setToast(null), []);
  /** Отказ действия — текстом кода ошибки кабинета. */
  const failed = (result: ProgramActionResult<unknown>) => {
    if (result.status !== "error") return;
    notify("error", tAdmin(`developers.errors.${(result.error ?? "invalid") as "invalid"}`));
  };
  return { toast, notify, closeToast, failed };
}

type Panels = ReturnType<typeof usePanels>;
type Toast = ReturnType<typeof useToast>;

/** Перестановка стрелкой: новый порядок id или null — двигать некуда. */
function movedOrder(panel: ProgramPanel, id: string, direction: "up" | "down"): string[] | null {
  const order = panel.programs.map((program) => program.id);
  const from = order.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return null;
  [order[from], order[to]] = [order[to]!, order[from]!];
  return order;
}

/** Отказ тумблера («последнюю не выключить») — строкой в своей карточке, а не полосой внизу. */
export type ToggleRefusal = { id: string; text: string };

function useCommands(store: Panels, toast: Toast, actions: ProgramActions | null, t: ProgramsT) {
  const tAdmin = useTranslations("admin");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<ToggleRefusal | null>(null);
  const toggle = async (item: ProgramItem, next: boolean) => {
    if (!actions) return;
    setPendingId(item.id);
    setRefusal(null);
    const fields = { id: item.id, active: String(next), developerId: item.developerId };
    const result = await actions.setActive(formOf(fields));
    setPendingId(null);
    if (result.status === "error") {
      const code = (result.error ?? "invalid") as "invalid";
      return setRefusal({ id: item.id, text: tAdmin(`developers.errors.${code}`) });
    }
    store.putItem({ ...item, isActive: next, record: { ...item.record, is_active: next } });
    toast.notify("success", t(next ? "toast.on" : "toast.off", { name: programFullName(item, t) }));
  };
  const move = async (panel: ProgramPanel, item: ProgramItem, direction: "up" | "down") => {
    const order = actions ? movedOrder(panel, item.id, direction) : null;
    if (!actions || !order) return;
    const byId = new Map(panel.programs.map((program) => [program.id, program]));
    store.updatePanel(panel.id, (current) => ({
      ...current,
      programs: order.map((id) => byId.get(id)!),
    }));
    const result = await actions.reorder(formOf({ developerId: panel.id, ids: order }));
    if (result.status === "error") {
      store.updatePanel(panel.id, () => panel);
      toast.failed(result);
    }
  };
  const markChecked = async (panel: ProgramPanel) => {
    if (!actions) return;
    const result = await actions.markChecked(formOf({ developerId: panel.id }));
    if (result.status === "error") return toast.failed(result);
    store.updatePanel(panel.id, (current) => ({ ...current, checkedAt: result.payload }));
    toast.notify("success", t("panel.checkedDone", { name: panel.name }));
  };
  return { pendingId, refusal, toggle, move, markChecked };
}

export function useProgramsState(
  screen: ProgramsScreenData,
  actions: ProgramActions | null,
  t: ProgramsT,
) {
  const store = usePanels(screen.panels);
  const toast = useToast();
  const [rate, setRate] = useSyncedState(screen.rate);
  const commands = useCommands(store, toast, actions, t);
  return { ...store, ...toast, ...commands, rate, setRate };
}

export type ProgramsState = ReturnType<typeof useProgramsState>;
