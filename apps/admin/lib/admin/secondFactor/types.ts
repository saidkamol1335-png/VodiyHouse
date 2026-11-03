// Ответы экрана кода второго фактора (/kod, PLAN §10 п. 8).
export type FactorResult =
  | { status: "idle" }
  | { status: "sent"; at: number }
  | { status: "link"; url: string }
  /** 10 запасных кодов — показать один раз (/kod/zapasnye). */
  | { status: "codes"; codes: string[] }
  | {
      status: "error";
      error:
        | "noTelegram"
        | "tooSoon"
        | "noBot"
        | "sendFailed"
        | "wrongCode"
        | "linked"
        | "issued"
        | "session"
        | "forbidden"
        | "network"
        | "notConfigured"
        | "unknown";
    };
