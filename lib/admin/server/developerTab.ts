import "server-only";
import { notFound } from "next/navigation";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import type { DeveloperRecord } from "../developers/types";
import { getDeveloper } from "./developerPage";

/**
 * Вкладка застройщика сама проверяет руководителя: переход между вкладками не перерисовывает
 * layout. null — показывать нечего (отказ и «база не подключена» уже показал layout).
 */
export async function developerForTab(
  params: Promise<{ id: string }>,
): Promise<DeveloperRecord | null> {
  const { allowed } = await requireSection("developers");
  if (!allowed || isCabinetOpenWithoutLogin || !hasSupabaseEnv()) return null;
  const developer = await getDeveloper((await params).id);
  if (!developer) notFound();
  return developer;
}
