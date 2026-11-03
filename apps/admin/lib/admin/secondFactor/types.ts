// Ответы экрана кода второго фактора (/kod, PLAN §10 п. 8).
export type FactorResult =
  | { status: "idle" }
  | { status: "sent"; at: number }
  | { status: "link"; url: string }
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
