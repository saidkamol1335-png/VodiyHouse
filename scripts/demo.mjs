// DEMO-данные в облачной базе (PLAN §0.11): `npm run demo:seed` — пересоздать,
// `npm run demo:remove` — удалить одной командой. SQL — supabase/demo/*.sql (те же файлы
// проверяются в PGlite: tests/db/demo.test.ts).
// Строка подключения — SUPABASE_DB_URL из .env.local (см. .env.example).

import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { dbClientConfig } from "../lib/supabase/dbClient.ts";
import { removeDemoMedia, seedDemoMedia } from "./demoMedia.mjs";

const DEMO_DIR = path.join(import.meta.dirname, "..", "supabase", "demo");
// Сид всегда начинается с удаления: повторный запуск даёт чистый DEMO, а не дубли. Фото DEMO-ЖК
// (scripts/demoMedia.mjs): файлы удаляются до remove.sql (после него id ЖК не узнать), грузятся после seed.sql.
// `demo:seed -- stress` — плюс «худший», «лучший» и 30 ЖК для нагрузки (stress.sql, приёмка 3а).
const STEPS = {
  seed: ["remove.sql", "seed.sql"],
  stress: ["remove.sql", "seed.sql", "stress.sql"],
  remove: ["remove.sql"],
};

const action = process.argv[2] === "seed" && process.argv[3] === "stress" ? "stress" : process.argv[2];
if (!(action in STEPS)) {
  console.error("Использование: node scripts/demo.mjs seed [stress] | remove");
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Нет SUPABASE_DB_URL в .env.local — строка подключения к базе, см. .env.example.");
  process.exit(1);
}

const client = new pg.Client(dbClientConfig(connectionString));
await client.connect();
try {
  const removedFiles = await removeDemoMedia(client);
  for (const file of STEPS[action]) {
    await client.query(await readFile(path.join(DEMO_DIR, file), "utf8"));
  }
  const uploaded = action === "remove" ? 0 : await seedDemoMedia(client);
  console.log(`Фото DEMO в Storage: удалено ${removedFiles}, загружено ${uploaded}.`);
  const { rows } = await client.query(
    `select
       (select count(*) from public.developers where slug like 'demo-%')::int as developers,
       (select count(*) from public.complexes where slug like 'demo-%')::int as complexes,
       (select count(*) from public.units u join public.blocks b on b.id = u.block_id
          join public.complexes c on c.id = b.complex_id where c.slug like 'demo-%')::int as units`,
  );
  const { developers, complexes, units } = rows[0];
  console.log(`DEMO в базе: застройщиков ${developers}, ЖК ${complexes}, квартир ${units}.`);
} finally {
  await client.end();
}
