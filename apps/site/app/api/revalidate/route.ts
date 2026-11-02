import { revalidateTag } from "next/cache";
import {
  isRevalidateSecret,
  parseRevalidateBody,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRevalidate,
} from "@vh/shared/revalidate";

// Сброс кэша сайта из админки (PLAN §10): правка в кабинете видна на сайте за секунды, без
// пересборки. Сайт сам ничего не знает о кабинете — принимает только подписанный список тегов.
const MAX_BODY = 8_000;

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!isRevalidateSecret(secret)) return new Response(null, { status: 503 });
  // Длина — по заголовку до чтения тела: огромный запрос не читается вовсе.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });
  const body = await request.text().catch(() => "");
  if (body.length > MAX_BODY) return new Response(null, { status: 413 });
  const signed = verifyRevalidate({
    secret,
    timestamp: request.headers.get(TIMESTAMP_HEADER),
    signature: request.headers.get(SIGNATURE_HEADER),
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  });
  if (!signed) return new Response(null, { status: 401 });
  const tags = parseRevalidateBody(body);
  if (!tags) return new Response(null, { status: 400 });
  // Не Server Action: updateTag здесь нельзя — «сейчас» истекает сразу, «косметика» — фоном.
  for (const tag of tags.now) revalidateTag(tag, { expire: 0 });
  for (const tag of tags.stale) revalidateTag(tag, "max");
  return Response.json({ revalidated: tags.now.length + tags.stale.length }, { headers: { "cache-control": "no-store" } });
}
