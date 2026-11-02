"use server";

import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { PreviewLinkResult } from "@/lib/admin/previewLink";
import { requireActionViewer } from "@/lib/admin/session";
import { siteOrigin } from "@/lib/site/metadata";

// Предпросмотр ЖК (PLAN §10, фаза C): кабинет на своём домене, cookie сотрудника сайт не видит.
// База выдаёт грант на 15 минут (create_preview_grant), сайт открывает по нему черновик:
// <сайт>/preview/zhk/<slug>?token=…&lang=…

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function previewLinkAction(complexId: string, lang: "ru" | "uz"): Promise<PreviewLinkResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (typeof complexId !== "string" || !UUID.test(complexId) || (lang !== "ru" && lang !== "uz")) {
    return { status: "error", error: "invalid" };
  }
  const [grant, row] = await Promise.all([
    guard.supabase.rpc("create_preview_grant", { p_complex: complexId }),
    guard.supabase.from("complexes").select("slug").eq("id", complexId).maybeSingle(),
  ]);
  if (grant.error) return { status: "error", error: contentDbErrorCode(grant.error) };
  if (row.error) return { status: "error", error: contentDbErrorCode(row.error) };
  if (!row.data?.slug || typeof grant.data !== "string") return { status: "error", error: "notFound" };
  const query = new URLSearchParams({ token: grant.data, lang });
  return { status: "ok", url: `${siteOrigin()}/preview/zhk/${row.data.slug}?${query.toString()}` };
}
