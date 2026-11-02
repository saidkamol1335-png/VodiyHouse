import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { deliverLead } from "./deliver";
import { sameSecret } from "./secret";

// Вебхук новой заявки (PLAN §10, п. 5): триггер базы через pg_net (миграция 20261102200000) зовёт
// /api/hooks/lead с секретом LEAD_HOOK_SECRET (тот же — в Vault, lead_hook_secret). Очередь, повтор
// и «не доставлено» решает база (lead_for_delivery); не дошло — повторит расписание.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SECRET_LENGTH = 32;

export type LeadHookResult = { status: 200 | 400 | 403 | 503; body: Record<string, unknown> };

export async function handleLeadHook(secretHeader: string | null, payload: unknown): Promise<LeadHookResult> {
  const secret = process.env.LEAD_HOOK_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH || !sameSecret(secretHeader ?? "", secret)) return { status: 403, body: { error: "forbidden" } };
  if (!hasSupabaseAdminEnv()) return { status: 503, body: { error: "not configured" } };
  const id = (payload as { id?: unknown } | null)?.id;
  if (typeof id !== "string" || !UUID.test(id)) return { status: 400, body: { error: "invalid" } };
  await deliverLead(createSupabaseAdminClient(), id);
  return { status: 200, body: { ok: true } };
}
