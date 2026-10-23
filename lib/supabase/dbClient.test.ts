import pg from "pg";
import { describe, expect, it } from "vitest";
import { dbClientConfig } from "./dbClient";

const POOLER =
  "postgresql://postgres.abcd:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";

describe("dbClientConfig", () => {
  it("адрес из панели без sslmode — всё равно TLS", () => {
    const client = new pg.Client(dbClientConfig(POOLER));
    expect(client.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("sslmode в адресе важнее: исполнитель может выключить TLS или включить полную проверку", () => {
    expect(new pg.Client(dbClientConfig(`${POOLER}?sslmode=disable`)).ssl).toBe(false);
    expect(new pg.Client(dbClientConfig(`${POOLER}?sslmode=verify-full`)).ssl).toEqual({});
  });
});
