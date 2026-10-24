// Курс ЦБ Узбекистана (PLAN §7 фаза 2): JSON-архив cbu.uz. Пишет его в базу функция
// set_cbu_exchange_rate — по команде `npm run rate:update`, кнопкой руководителя и (после деплоя)
// по расписанию.

export const CBU_USD_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/";

/** Те же пределы, что у private.check_exchange_rate: иное — сбой источника, а не курс. */
export const USD_UZS_RANGE = { min: 1000, max: 100_000 } as const;

const FETCH_TIMEOUT_MS = 10_000;

export type CbuRate = { usdUzs: number; date: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Ответ ЦБ: [{Ccy: "USD", Rate: "12045.67", Nominal: "1", Date: "24.10.2026"}]; иное — null. */
export function parseCbuResponse(body: unknown): CbuRate | null {
  if (!Array.isArray(body)) return null;
  const usd = body.find((item) => isRecord(item) && item.Ccy === "USD");
  if (!isRecord(usd)) return null;
  const rate = Number(String(usd.Rate).replace(",", "."));
  const nominal = Number(usd.Nominal ?? 1);
  const date = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(usd.Date));
  if (!Number.isFinite(rate) || !(nominal > 0) || !date) return null;
  const usdUzs = rate / nominal;
  if (usdUzs < USD_UZS_RANGE.min || usdUzs > USD_UZS_RANGE.max) return null;
  return { usdUzs, date: `${date[3]}-${date[2]}-${date[1]}` };
}

/** Курс доллара на сегодня; сбой сети, ответ не 200 или чужой формат — ошибка с причиной. */
export async function fetchCbuUsdRate(fetchImpl: typeof fetch = fetch): Promise<CbuRate> {
  const response = await fetchImpl(CBU_USD_URL, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`ЦБ ответил ${response.status}`);
  const rate = parseCbuResponse(await response.json());
  if (!rate) throw new Error("ЦБ прислал курс в неожиданном виде");
  return rate;
}
