import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ABOUT_HISTORY_KEY, ABOUT_TEAM_KEY, type AboutEvent, aboutHistoryFrom, aboutTeamFrom, type TeamMember } from "@vh/shared/about";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// «Tarix» и «Jamoa» на /o-nas (правки 15.11, п. 25): public_settings ролью посетителя, в кэше как
// контакты; «Настройки → О компании» кабинета сбрасывает SITE_SETTINGS_TAG.

export type AboutContent = { history: AboutEvent[]; team: TeamMember[] };

const EMPTY: AboutContent = { history: [], team: [] };

async function fetchAbout(): Promise<AboutContent> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("key, value")
    .in("key", [ABOUT_HISTORY_KEY, ABOUT_TEAM_KEY]);
  if (error) throw new Error("site-about-unavailable", { cause: error });
  const value = (key: string) => data?.find((row) => row.key === key)?.value;
  return { history: aboutHistoryFrom(value(ABOUT_HISTORY_KEY)), team: aboutTeamFrom(value(ABOUT_TEAM_KEY)) };
}

/** Нет облака или база не ответила — разделов нет: страница с офисом и картой работает. */
export async function readAbout(): Promise<AboutContent> {
  if (!hasSupabaseEnv()) return EMPTY;
  try {
    return await fetchAbout();
  } catch (error) {
    console.error("[site] история и команда недоступны", error);
    return EMPTY;
  }
}
