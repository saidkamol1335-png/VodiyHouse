import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRequests, type PublicationRequest, type RequestRecord } from "../complexes/requests";

// Запросы руководителю (PLAN §10, п. 25) сессией сотрудника: читают руководитель и менеджер (RLS).

const COLUMNS =
  "id, complex_id, kind, status, note, answer, requested_at, resolved_at, requested_by, requester:profiles!publication_requests_requested_by_fkey(full_name)";

/** Последние запросы ЖК — открытый и история с ответами руководителя («Публикация»). */
export async function readComplexRequests(
  supabase: SupabaseClient,
  complexId: string,
): Promise<PublicationRequest[]> {
  const { data, error } = await supabase
    .from("publication_requests")
    .select(COLUMNS)
    .eq("complex_id", complexId)
    .order("requested_at", { ascending: false })
    .limit(5);
  if (error) throw new Error("publication-requests-unavailable", { cause: error });
  return parseRequests((data ?? []) as unknown as RequestRecord[]);
}

/** Открытые запросы всех ЖК: значок «Ожидает руководителя» в списке и на главной. */
export async function readPendingRequests(supabase: SupabaseClient): Promise<PublicationRequest[]> {
  const { data, error } = await supabase
    .from("publication_requests")
    .select(COLUMNS)
    .eq("status", "pending")
    .order("requested_at");
  if (error) throw new Error("publication-requests-unavailable", { cause: error });
  return parseRequests((data ?? []) as unknown as RequestRecord[]);
}
