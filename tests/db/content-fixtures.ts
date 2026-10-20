import type { Db } from "./harness";

type PublicationStatus = "draft" | "published" | "hidden" | "archived";

/** Набор контента на все случаи видимости: что видит сайт, а что — только сотрудники. */
export type ContentIds = {
  publicDeveloper: string;
  draftDeveloper: string;
  publicComplex: string;
  draftComplex: string;
  hiddenComplex: string;
  /** Опубликованный ЖК у неопубликованного застройщика — на сайт не попадает. */
  orphanComplex: string;
  publicBlock: string;
  draftBlock: string;
  oneRoomLayout: string;
  twoRoomLayout: string;
  /** Квартиры публичного блока: 1–2 — 1-комн., 3–4 — 2-комн.; статусы free, free, reserved, sold. */
  units: string[];
  publicPhoto: string;
  draftPhoto: string;
};

async function insertId(admin: Db, sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(`${sql} returning id`, params);
  return rows[0]!.id;
}

export async function seedContent(admin: Db): Promise<ContentIds> {
  const developer = (slug: string, status: PublicationStatus) =>
    insertId(admin, "insert into developers (slug, name, status) values ($1, $1, $2)", [
      slug,
      status,
    ]);
  const complex = (developerId: string, slug: string, status: PublicationStatus) =>
    insertId(
      admin,
      `insert into complexes (developer_id, slug, name, status)
       values ($1, $2, jsonb_build_object('ru', $2::text, 'uz', $2::text), $3)`,
      [developerId, slug, status],
    );
  const block = (complexId: string) =>
    insertId(admin, "insert into blocks (complex_id, name, floors_total) values ($1, 'A', 16)", [
      complexId,
    ]);
  const layout = (blockId: string, rooms: number, area: number) =>
    insertId(admin, "insert into layouts (block_id, rooms, area) values ($1, $2, $3)", [
      blockId,
      rooms,
      area,
    ]);
  const photo = (complexId: string, path: string) =>
    insertId(
      admin,
      "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 2400, 1600)",
      [complexId, path],
    );

  const publicDeveloper = await developer("public-dev", "published");
  const draftDeveloper = await developer("draft-dev", "draft");
  const publicComplex = await complex(publicDeveloper, "public-zhk", "published");
  const draftComplex = await complex(publicDeveloper, "draft-zhk", "draft");
  const hiddenComplex = await complex(publicDeveloper, "hidden-zhk", "hidden");
  const orphanComplex = await complex(draftDeveloper, "orphan-zhk", "published");
  const publicBlock = await block(publicComplex);
  const draftBlock = await block(draftComplex);
  const oneRoomLayout = await layout(publicBlock, 1, 42.5);
  const twoRoomLayout = await layout(publicBlock, 2, 58.7);

  const units: string[] = [];
  const statuses = ["free", "free", "reserved", "sold"];
  for (const [index, status] of statuses.entries()) {
    const layoutId = index < 2 ? oneRoomLayout : twoRoomLayout;
    units.push(
      await insertId(
        admin,
        `insert into units (block_id, layout_id, entrance, floor, position, number, price, status)
         values ($1, $2, 1, 2, $3, $4, $5, $6)`,
        [publicBlock, layoutId, index + 1, String(index + 1), 30_000 + index * 1_000, status],
      ),
    );
  }

  await admin.query(
    `insert into developer_private (developer_id, contacts) values ($1, '+998 90 000-00-00')`,
    [publicDeveloper],
  );
  await admin.query(
    `insert into developer_past_projects (developer_id, name, planned_on, delivered_on)
     values ($1, '{"ru": "Сданный дом", "uz": "Topshirilgan uy"}', '2022-12-31', '2023-03-31')`,
    [publicDeveloper],
  );
  await admin.query(
    `insert into developer_past_projects (developer_id, name) values ($1, '{"ru": "Скрытый дом", "uz": "Yashirin uy"}')`,
    [draftDeveloper],
  );
  const publicPhoto = await photo(publicComplex, "complexes/public-zhk/1.jpg");
  const draftPhoto = await photo(draftComplex, "complexes/draft-zhk/1.jpg");

  return {
    publicDeveloper,
    draftDeveloper,
    publicComplex,
    draftComplex,
    hiddenComplex,
    orphanComplex,
    publicBlock,
    draftBlock,
    oneRoomLayout,
    twoRoomLayout,
    units,
    publicPhoto,
    draftPhoto,
  };
}
