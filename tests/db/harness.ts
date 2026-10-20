import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect } from "vitest";
import type { StaffRole } from "@/lib/admin/access";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const SHIM_FILE = path.join(import.meta.dirname, "supabase-shim.sql");

/** Кто выполняет запрос: как в облаке, роль Postgres и claims JWT задают RLS. */
export type Actor = { kind: "anon" } | { kind: "user"; id: string } | { kind: "service" };

/** Общее у PGlite и облачной базы (pg): тесты не знают, где выполняются. */
export type Db = {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
};

export type TestDb = {
  /** Владелец таблиц: подготовка данных в обход RLS. */
  admin: Db;
  /** Запросы от имени роли; ошибка внутри откатывает только их. */
  as<T>(actor: Actor, run: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export const PG_ROLE: Record<Actor["kind"], string> = {
  anon: "anon",
  user: "authenticated",
  service: "service_role",
};

export const anon: Actor = { kind: "anon" };
export const service: Actor = { kind: "service" };
export const user = (id: string): Actor => ({ kind: "user", id });

/** `npm run test:db:remote` — те же тесты против облачной базы (tests/db/remote.ts). */
export const isRemoteTarget = process.env.DB_TEST_TARGET === "remote";

export function claimsOf(actor: Actor): string {
  const role = PG_ROLE[actor.kind];
  return JSON.stringify(actor.kind === "user" ? { sub: actor.id, role } : { role });
}

/** Чистая база: в PGlite — заглушка Supabase + все миграции, как `supabase db push`. */
export async function createTestDb(): Promise<TestDb> {
  if (isRemoteTarget) {
    const { createRemoteTestDb } = await import("./remote");
    return createRemoteTestDb();
  }
  const admin = await PGlite.create();
  await admin.exec(await readFile(SHIM_FILE, "utf8"));
  for (const file of await migrationFiles()) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await admin.exec(sql);
    } catch (error) {
      throw new Error(`Миграция ${file} не применилась: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }
  return {
    admin,
    as: (actor, run) =>
      admin.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [claimsOf(actor)]);
        await tx.exec(`set local role ${PG_ROLE[actor.kind]}`);
        return run(tx);
      }),
    close: () => admin.close(),
  };
}

export async function migrationFiles(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

/** Запрос отклонён правами: нет GRANT или новая строка не прошла политику RLS. */
export async function expectDenied(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toThrow(/permission denied|row-level security/);
}

/** Отказ базы с машиночитаемым кодом (hint 'vh:…', см. lib/admin/authErrors.ts). */
export async function expectHint(promise: Promise<unknown>, hint: string): Promise<void> {
  await expect(promise).rejects.toMatchObject({ hint });
}

type StaffOptions = { fullName?: string; isActive?: boolean; mustChangePassword?: boolean; email?: string };

/** Создаёт пользователя Auth и профиль сотрудника в обход RLS (как сервер с ключом service_role). */
export async function createStaff(admin: Db, role: StaffRole, options: StaffOptions = {}): Promise<string> {
  const { fullName = `Тест · ${role}`, isActive = true, mustChangePassword = true } = options;
  const email = options.email ?? `${role}-${crypto.randomUUID()}@test.local`;
  const created = await admin.query<{ id: string }>("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [
    email,
  ]);
  const id = created.rows[0]!.id;
  await admin.query(
    `insert into public.profiles (id, full_name, role, is_active, must_change_password)
     values ($1, $2, $3, $4, $5)`,
    [id, fullName, role, isActive, mustChangePassword],
  );
  return id;
}

/** Пользователь Auth без профиля — как после auth.admin.createUser, до вставки профиля. */
export async function createAuthUser(admin: Db, email = `new-${crypto.randomUUID()}@test.local`): Promise<string> {
  const created = await admin.query<{ id: string }>("insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id", [
    email,
  ]);
  return created.rows[0]!.id;
}
