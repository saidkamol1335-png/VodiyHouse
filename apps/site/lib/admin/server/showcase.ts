import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaPreview } from "@/components/MediaDrop";
import { bilingualFrom } from "../bilingual";
import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication";
import { filterSearchFrom } from "../showcase/filterForm";
import type {
  AdRecord,
  CollectionRecord,
  ComplexOption,
  ShowcaseKind,
  ShowcaseListRow,
  ShowcaseOptions,
  SpecialRecord,
} from "../showcase/types";
import { readDeveloperOptions } from "./complexes";
import { mediaSrc } from "./developerPage";
import { readDictionary } from "./developers";

// Чтение «Витрины» сессией руководителя (RLS). Ошибка базы — исключение: app/admin/error.tsx
// покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

const TABLE: Record<ShowcaseKind, "specials" | "collections" | "ads"> = {
  special: "specials",
  collection: "collections",
  ad: "ads",
};

const OWNER_COLUMN: Record<ShowcaseKind, "special_id" | "collection_id" | "ad_id"> = {
  special: "special_id",
  collection: "collection_id",
  ad: "ad_id",
};

type Row = {
  id: string;
  developer_id?: string;
  kind?: string;
  slug?: string;
  mode?: string;
  badge?: unknown;
  title: unknown;
  text?: unknown;
  complex_ids: string[] | null;
  filter?: unknown;
  valid_from?: string;
  valid_to?: string;
  is_active: boolean;
  sort: number;
  created_at: string;
  developers?: { name: string } | null;
};

const COLUMNS = {
  special: "id, developer_id, kind, badge, title, text, complex_ids, valid_from, valid_to, is_active, sort, created_at, developers(name)",
  collection: "id, slug, title, mode, complex_ids, filter, is_active, sort, created_at",
  ad: "id, developer_id, title, text, complex_ids, filter, valid_from, valid_to, is_active, sort, created_at, developers(name)",
} as const;

async function readRows(supabase: SupabaseClient, kind: ShowcaseKind, id?: string): Promise<Row[]> {
  // Строка колонок как string: типизация PostgREST не разбирает объединение трёх списков.
  let query = supabase.from(TABLE[kind]).select(COLUMNS[kind] as string).order("sort").order("created_at");
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) unavailable(`showcase-${kind}`, error);
  return (data ?? []) as unknown as Row[];
}

/** Пути обложек по владельцу: один запрос на вкладку. */
async function readCovers(supabase: SupabaseClient, kind: ShowcaseKind, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const column = OWNER_COLUMN[kind];
  const { data, error } = await supabase
    .from("media_assets")
    .select(`${column}, path`)
    .eq("kind", "cover")
    .in(column, ids);
  if (error) unavailable("showcase-covers", error);
  return new Map(((data ?? []) as unknown as Record<string, string>[]).map((row) => [row[column]!, row.path!]));
}

const hasFilter = (filter: unknown): boolean =>
  typeof filter === "object" && filter !== null && !Array.isArray(filter) && Object.keys(filter).length > 0;

function listRow(kind: ShowcaseKind, row: Row, coverPath: string | null): ShowcaseListRow {
  const complexCount = row.complex_ids?.length ?? 0;
  return {
    id: row.id,
    kind,
    title: bilingualFrom(row.title).ru,
    developerName: row.developers?.name ?? null,
    complexCount,
    // Подборка вручную или реклама «по ЖК», у которых ЖК удалили (массив опустел), — не «по фильтру».
    byFilter: kind === "collection" ? row.mode === "filter" : kind === "ad" ? hasFilter(row.filter) : false,
    validFrom: row.valid_from ?? null,
    validTo: row.valid_to ?? null,
    isActive: row.is_active,
    sort: row.sort,
    createdAt: row.created_at,
    coverPath,
  };
}

/** Строки вкладки с обложками. */
export async function readShowcaseRows(supabase: SupabaseClient, kind: ShowcaseKind): Promise<ShowcaseListRow[]> {
  const rows = await readRows(supabase, kind);
  const covers = await readCovers(supabase, kind, rows.map((row) => row.id));
  return rows.map((row) => listRow(kind, row, covers.get(row.id) ?? null));
}

const isKind = (value: unknown): value is SpecialRecord["kind"] =>
  value === "gift" || value === "installment" || value === "bank" || value === "sales_start";

export async function readSpecial(supabase: SupabaseClient, id: string): Promise<SpecialRecord | null> {
  const [row] = await readRows(supabase, "special", id);
  if (!row) return null;
  return {
    id: row.id,
    developerId: row.developer_id ?? "",
    kind: isKind(row.kind) ? row.kind : "gift",
    badge: bilingualFrom(row.badge),
    title: bilingualFrom(row.title),
    text: row.text ? bilingualFrom(row.text) : null,
    complexIds: row.complex_ids ?? [],
    validFrom: row.valid_from ?? "",
    validTo: row.valid_to ?? "",
    isActive: row.is_active,
    sort: row.sort,
  };
}

export async function readCollection(supabase: SupabaseClient, id: string): Promise<CollectionRecord | null> {
  const [row] = await readRows(supabase, "collection", id);
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug ?? "",
    title: bilingualFrom(row.title),
    mode: row.mode === "manual" ? "manual" : "filter",
    complexIds: row.complex_ids ?? [],
    filter: filterSearchFrom(row.filter),
    isActive: row.is_active,
    sort: row.sort,
  };
}

export async function readAd(supabase: SupabaseClient, id: string): Promise<AdRecord | null> {
  const [row] = await readRows(supabase, "ad", id);
  if (!row) return null;
  return {
    id: row.id,
    developerId: row.developer_id ?? "",
    title: bilingualFrom(row.title),
    text: row.text ? bilingualFrom(row.text) : null,
    complexIds: row.complex_ids ?? [],
    filter: filterSearchFrom(row.filter),
    validFrom: row.valid_from ?? "",
    validTo: row.valid_to ?? "",
    isActive: row.is_active,
    sort: row.sort,
  };
}

type ComplexRowRecord = { id: string; name: unknown; status: string; developer_id: string };

const isStatus = (value: string): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly string[]).includes(value);

/** ЖК для выбора — все, кроме архивных: не опубликованные остаются с плашкой. */
async function readComplexOptions(supabase: SupabaseClient): Promise<ComplexOption[]> {
  const { data, error } = await supabase.rpc("complex_rows");
  if (error) unavailable("complex-rows", error);
  return ((data ?? []) as ComplexRowRecord[])
    .filter((row) => row.status !== "archived")
    .map((row) => ({
      id: row.id,
      name: bilingualFrom(row.name).ru,
      developerId: row.developer_id,
      status: isStatus(row.status) ? row.status : "draft",
    }));
}

/** Застройщики, ЖК и города для форм витрины. */
export async function readShowcaseOptions(supabase: SupabaseClient): Promise<ShowcaseOptions> {
  const [developers, complexes, locations] = await Promise.all([
    readDeveloperOptions(supabase),
    readComplexOptions(supabase),
    readDictionary(supabase, "locations"),
  ]);
  return {
    developers,
    complexes,
    locations: locations
      .filter((item) => item.isActive)
      .map((item) => ({ slug: item.slug, name: item.name.ru, kind: item.kind ?? "city" })),
  };
}

type CoverRow = { path: string; width: number; height: number; focus_x: number; focus_y: number };

/** Обложка записи для MediaDrop; null — нет. */
export async function readShowcaseCover(supabase: SupabaseClient, kind: ShowcaseKind, id: string): Promise<MediaPreview | null> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("path, width, height, focus_x, focus_y")
    .eq("kind", "cover")
    .eq(OWNER_COLUMN[kind], id)
    .maybeSingle();
  if (error) unavailable("showcase-cover", error);
  if (!data) return null;
  const cover = data as CoverRow;
  return { src: mediaSrc(cover.path), width: cover.width, height: cover.height, focus: { x: cover.focus_x, y: cover.focus_y } };
}
