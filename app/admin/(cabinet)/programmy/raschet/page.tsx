import { ClientCalculator } from "@/components/ClientCalculator";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { saveCalculationAction } from "@/lib/admin/actions/calculations";
import { readClientCalc } from "@/lib/admin/server/clientCalc";
import { requireSection } from "@/lib/admin/session";
import { readCalcParams } from "@/lib/calc/params";
import { pickMessages } from "@/lib/i18n/clientMessages";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import uz from "@/messages/uz.json";

export const instant = false;

/** Тексты для сообщения клиенту на узбекском: калькулятор и строки скидки (кабинет — на русском). */
const UZ_TELEGRAM = pickMessages(uz, ["calc", "admin.calcTelegram"]);

type ClientCalcPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** «Расчёт для клиента» (шаг 2.5, Р1): застройщик и параметры — в адресе (одна схема с сайтом). */
export default async function ClientCalcPage({ searchParams }: ClientCalcPageProps) {
  const { allowed } = await requireSection("programs");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return null;
  const params = readCalcParams(await searchParams);
  const screen = await readClientCalc(await createSupabaseServerClient(), params.developer);
  return (
    <ClientCalculator
      screen={screen}
      initialParams={{ ...params, developer: screen.current?.slug ?? null }}
      uzMessages={UZ_TELEGRAM}
      save={saveCalculationAction}
    />
  );
}
