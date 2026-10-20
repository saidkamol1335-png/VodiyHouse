import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bilingualFrom } from "../bilingual";
import {
  dictionaryColumns,
  parseDictionaryItems,
  type DictionaryItem,
  type DictionaryKey,
  type DictionaryRecord,
} from "../dictionaries/definitions";
import {
  parseDeveloperRows,
  type DeveloperListRow,
  type DeveloperRowRecord,
} from "../developers/list";
import { draftsFrom, type ProjectDraft } from "../developers/projects";
import type { PrivateNotes } from "../developers/privateNotes";
import type { DeveloperRecord } from "../developers/types";
import { journalPage, JOURNAL_PAGE, type JournalPage, type JournalRecord } from "../journal/format";
import { PUBLICATION_STATUSES, type PublicationStatus } from "../publication";

// Чтение данных кабинета застройщиков и справочников сессией сотрудника (RLS). Ошибка сети или
// базы — исключение: app/admin/error.tsx покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export async function readDeveloperRows(supabase: SupabaseClient): Promise<DeveloperListRow[]> {
  const { data, error } = await supabase.rpc("developer_rows");
  if (error) unavailable("developer-rows", error);
  return parseDeveloperRows((data ?? []) as DeveloperRowRecord[]);
}

const DEVELOPER_COLUMNS =
  "id, slug, name, status, founded_year, flats_delivered, delivered_checked_at, about, founders, archived_at";

type DeveloperRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  founded_year: number | null;
  flats_delivered: number | null;
  delivered_checked_at: string | null;
  about: unknown;
  founders: unknown;
  archived_at: string | null;
};

const isStatus = (value: string): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly string[]).includes(value);

function developerFrom(row: DeveloperRow): DeveloperRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: isStatus(row.status) ? row.status : "draft",
    foundedYear: row.founded_year,
    flatsDelivered: row.flats_delivered,
    deliveredCheckedAt: row.delivered_checked_at,
    about: row.about ? bilingualFrom(row.about) : null,
    founders: row.founders ? bilingualFrom(row.founders) : null,
    archivedAt: row.archived_at,
  };
}

/** Застройщик страницы; null — нет такого (или не виден по RLS) → notFound(). */
export async function readDeveloper(
  supabase: SupabaseClient,
  id: string,
): Promise<DeveloperRecord | null> {
  const { data, error } = await supabase
    .from("developers")
    .select(DEVELOPER_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) unavailable("developer", error);
  return data ? developerFrom(data as DeveloperRow) : null;
}

export type DeveloperMedia = {
  kind: "logo" | "cover";
  path: string;
  width: number;
  height: number;
  focusX: number;
  focusY: number;
};

type MediaRow = {
  kind: string;
  path: string;
  width: number;
  height: number;
  focus_x: number;
  focus_y: number;
};

export async function readDeveloperMedia(
  supabase: SupabaseClient,
  id: string,
): Promise<DeveloperMedia[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("kind, path, width, height, focus_x, focus_y")
    .eq("developer_id", id);
  if (error) unavailable("developer-media", error);
  return ((data ?? []) as MediaRow[])
    .filter((row) => row.kind === "logo" || row.kind === "cover")
    .map((row) => ({
      kind: row.kind as DeveloperMedia["kind"],
      path: row.path,
      width: row.width,
      height: row.height,
      focusX: row.focus_x,
      focusY: row.focus_y,
    }));
}

export async function readPastProjects(
  supabase: SupabaseClient,
  id: string,
): Promise<ProjectDraft[]> {
  const { data, error } = await supabase
    .from("developer_past_projects")
    .select("id, name, planned_on, delivered_on")
    .eq("developer_id", id)
    .order("sort");
  if (error) unavailable("past-projects", error);
  return draftsFrom(data ?? []);
}

export async function readPrivateNotes(
  supabase: SupabaseClient,
  id: string,
): Promise<PrivateNotes> {
  const { data, error } = await supabase
    .from("developer_private")
    .select("contacts, notes")
    .eq("developer_id", id)
    .maybeSingle();
  if (error) unavailable("developer-private", error);
  return { contacts: data?.contacts ?? "", notes: data?.notes ?? "" };
}

/** Страница журнала: застройщика или весь (null). before — продолжение «Показать ещё». */
export async function readJournal(
  supabase: SupabaseClient,
  developerId: string | null,
  before: number | null = null,
): Promise<JournalPage> {
  const { data, error } = await supabase.rpc("journal_entries", {
    p_developer: developerId,
    p_before: before,
    p_limit: JOURNAL_PAGE,
  });
  if (error) unavailable("journal", error);
  return journalPage((data ?? []) as JournalRecord[]);
}

export async function readDictionary(
  supabase: SupabaseClient,
  key: DictionaryKey,
): Promise<DictionaryItem[]> {
  const { data, error } = await supabase
    .from(key)
    .select(dictionaryColumns(key))
    .order("sort")
    .order("id");
  if (error) unavailable(`dictionary-${key}`, error);
  return parseDictionaryItems(key, (data ?? []) as unknown as DictionaryRecord[]);
}
