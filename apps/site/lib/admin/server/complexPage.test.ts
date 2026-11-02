import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffRole } from "@/lib/admin/access";
import type { PublicationStatus } from "@/lib/admin/publication";

// complexForTab — общий вход вкладок ЖК в /admin (не стенд): роль из сессии, ЖК из базы.
// Сессия, база и навигация Next — заглушки; notFound и redirect бросают, как настоящие.

const session = vi.hoisted(() => ({ role: "head" as StaffRole, allowed: true }));
const stored = vi.hoisted(() => ({ status: "published" as PublicationStatus | null }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/lib/admin/session", () => ({
  requireSection: async () => ({
    viewer: { id: "v", role: session.role, name: null, mustChangePassword: false },
    allowed: session.allowed,
  }),
}));
vi.mock("@/lib/admin/access", () => ({ isCabinetOpenWithoutLogin: false }));
vi.mock("@/lib/supabase/env", () => ({ hasSupabaseEnv: () => true }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({}) }));
vi.mock("./complexes", () => ({
  readComplex: async (_supabase: unknown, id: string) =>
    stored.status === null ? null : { id, status: stored.status },
  readReadiness: async () => [],
}));

const { complexForTab } = await import("./complexPage");

const ID = "00000000-0000-4000-8000-0000000000c1";
const params = Promise.resolve({ id: ID });
const open = (tab: Parameters<typeof complexForTab>[1]) =>
  complexForTab(Promise.resolve({ id: ID }), tab);

beforeEach(() => {
  session.role = "head";
  session.allowed = true;
  stored.status = "published";
});

describe("complexForTab: вкладки ЖК по роли (Н2)", () => {
  it("руководитель открывает любую вкладку, и архивный ЖК тоже", async () => {
    await expect(complexForTab(params, "blocks")).resolves.toMatchObject({ id: ID });
    stored.status = "archived";
    await expect(open("main")).resolves.toMatchObject({ status: "archived" });
  });

  it("менеджер: «Квартиры» открыты, другие вкладки перекидывают туда", async () => {
    session.role = "manager";
    await expect(open("units")).resolves.toMatchObject({ id: ID });
    for (const tab of ["main", "blocks", "layouts", "photos", "log"] as const) {
      await expect(open(tab)).rejects.toThrow(`REDIRECT /admin/zhk/${ID}/kvartiry`);
    }
  });

  it("менеджер: архивный ЖК — 404 и по прямой ссылке (М1)", async () => {
    session.role = "manager";
    stored.status = "archived";
    await expect(open("units")).rejects.toThrow("NOT_FOUND");
    stored.status = "hidden";
    await expect(open("units")).resolves.toMatchObject({ status: "hidden" });
  });

  it("раздел закрыт роли или ЖК нет — вкладке показывать нечего / 404", async () => {
    session.role = "videographer";
    session.allowed = false;
    await expect(open("units")).resolves.toBeNull();
    session.role = "manager";
    session.allowed = true;
    stored.status = null;
    await expect(open("units")).rejects.toThrow("NOT_FOUND");
  });
});
