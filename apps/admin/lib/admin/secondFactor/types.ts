// Ответы экрана кода второго фактора (/kod, PLAN §10 п. 8).
export type FactorResult =
  | { status: "idle" }
  | { status: "sent"; at: number }
  | { status: "link"; url: string }
  /** Первый вход со вторым фактором: 10 запасных кодов — показать один раз. */
  | { status: "backup"; codes: string[] }
  | {
      status: "error";
      error:
        | "noTelegram"
        | "tooSoon"
        | "noBot"
        | "sendFailed"
        | "wrongCode"
        | "linked"
        | "session"
        | "forbidden"
        | "network"
        | "notConfigured"
        | "unknown";
    };
