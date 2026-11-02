import { handleLeadHook } from "@/lib/leads/server/hook";

// Новая заявка → доставка в Telegram и Таблицу (lib/leads/server/hook.ts).
export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const { status, body } = await handleLeadHook(request.headers.get("x-vh-hook-secret"), payload);
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
