"use server";

import type { FlatCalcRecord } from "@/lib/calc/flatScreen";
import { readLayoutCalc } from "./flatCalc";

/** «Рассчитать платёж» у планировки: открытые данные сайта — без входа и без скидок (PLAN §3.13). */
export async function readLayoutCalcAction(layoutId: string): Promise<FlatCalcRecord | null> {
  if (typeof layoutId !== "string") return null;
  return readLayoutCalc(layoutId);
}
