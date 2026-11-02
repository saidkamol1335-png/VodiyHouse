"use server";

import { demoComplex } from "@/lib/admin/complexes/demoPage";
import type { PreviewLinkResult } from "@/lib/admin/previewLink";
import { complexRoute } from "@/lib/routes";
import { siteOrigin } from "@/lib/site/metadata";
import { devOnly } from "../devOnly";

/**
 * «Предпросмотр» на DEMO: у стенда нет входа и гранта — открывается опубликованная DEMO-страница
 * сайта (черновик без гранта сайт не покажет: 404).
 */
export async function demoPreviewLinkAction(complexId: string, lang: "ru" | "uz"): Promise<PreviewLinkResult> {
  devOnly();
  const complex = demoComplex(complexId);
  if (!complex) return { status: "error", error: "notFound" };
  return { status: "ok", url: `${siteOrigin()}/${lang === "uz" ? "uz" : "ru"}${complexRoute(complex.slug)}` };
}
