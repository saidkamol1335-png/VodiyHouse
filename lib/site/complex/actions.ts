"use server";

import { draftMode } from "next/headers";
import type { FlatCalcRecord } from "@/lib/calc/flatScreen";
import { readLayoutCalc } from "./flatCalc";

/**
 * «Рассчитать платёж» у планировки: открытые данные сайта — без входа и без скидок (PLAN §3.13).
 * В предпросмотре — сессией руководителя (черновик база считает только ему).
 */
export async function readLayoutCalcAction(layoutId: string): Promise<FlatCalcRecord | null> {
  if (typeof layoutId !== "string") return null;
  const { isEnabled: preview } = await draftMode();
  return readLayoutCalc(layoutId, preview);
}
