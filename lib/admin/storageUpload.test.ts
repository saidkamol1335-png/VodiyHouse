import { describe, expect, it, vi } from "vitest";
import { refuseUpload, UploadRefused } from "./storageUpload";

type Client = Parameters<typeof refuseUpload>[0];

const client = (signedIn: boolean) =>
  ({
    auth: {
      getSession: async () => ({ data: { session: signedIn ? { access_token: "t" } : null } }),
    },
  }) as unknown as Client;

const RLS = {
  status: 400,
  statusCode: "403",
  message: "new row violates row-level security policy",
};

async function refusal(signedIn: boolean, error: Parameters<typeof refuseUpload>[1]) {
  return refuseUpload(client(signedIn), error).catch((failure: unknown) => failure);
}

describe("refuseUpload", () => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("политика при живой сессии — «нет доступа»", async () => {
    const failure = await refusal(true, RLS);
    expect(failure).toBeInstanceOf(UploadRefused);
    expect((failure as UploadRefused).code).toBe("forbidden");
  });

  it("сессия потеряна в браузере — запрос ушёл публичным ключом, это «сессия закончилась»", async () => {
    expect(((await refusal(false, RLS)) as UploadRefused).code).toBe("session");
    const missingBucket = { status: 400, statusCode: "404", message: "Bucket not found" };
    expect(((await refusal(false, missingBucket)) as UploadRefused).code).toBe("session");
    expect(((await refusal(true, missingBucket)) as UploadRefused).code).toBe("unknown");
  });

  it("сбой сети — обычная ошибка: MediaDrop и галерея скажут «проверьте связь»", async () => {
    const failure = await refusal(true, { message: "Failed to fetch" });
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(UploadRefused);
  });
});
