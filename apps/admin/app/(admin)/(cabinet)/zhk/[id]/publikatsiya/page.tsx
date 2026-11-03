import { ComplexPublication } from "@/components/ComplexPublication";
import { setComplexStatusAction } from "@/lib/admin/actions/complexes";
import { loadJournalAction } from "@/lib/admin/actions/journal";
import { previewLinkAction } from "@/lib/admin/actions/preview";
import {
  cancelPublicationRequestAction,
  declinePublicationRequestAction,
  requestPublicationAction,
} from "@/lib/admin/actions/publicationRequests";
import type { ComplexRecord } from "@/lib/admin/complexes/record";
import { complexAccess } from "@/lib/admin/complexes/tabs";
import { finishingNames } from "@/lib/admin/journal/format";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { complexForTab, getComplexCompleteness, getComplexReadiness } from "@/lib/admin/server/complexPage";
import { readComplexFiles } from "@/lib/admin/server/complexes";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { readDictionary, readJournal } from "@/lib/admin/server/developers";
import { readComplexRequests } from "@/lib/admin/server/requests";
import { requireViewer } from "@/lib/admin/session";
import { complexRoute } from "@/lib/routes";
import { siteOrigin } from "@/lib/site/metadata";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const HEAD_ACTIONS = { request: null, cancel: null, decline: declinePublicationRequestAction };
const MANAGER_ACTIONS = { request: requestPublicationAction, cancel: cancelPublicationRequestAction, decline: null };

/** Застройщик ЖК: не опубликован — сайт ЖК не покажет; ссылка — на его страницу. */
const developerOf = (complex: ComplexRecord) =>
  complex.developerId
    ? {
        name: complex.developerName,
        published: complex.developerStatus === "published",
        href: `${ADMIN_ROUTES.developers}/${complex.developerId}`,
      }
    : null;

/** Вкладка «Публикация» (экран 3, PLAN §10 пп. 21, 25) — данные ЖК и действия по роли. */
export default async function ComplexPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "publication");
  if (!complex) return null;
  const viewer = await requireViewer();
  const access = complexAccess(viewer.role);
  const supabase = await createSupabaseServerClient();
  const [readiness, completeness, files, requests, journal, finishings] = await Promise.all([
    getComplexReadiness(complex.id),
    getComplexCompleteness(complex.id),
    readComplexFiles(supabase, complex.id),
    readComplexRequests(supabase, complex.id),
    readJournal(supabase, { developerId: null, complexId: complex.id }),
    readDictionary(supabase, "finishings"),
  ]);
  return (
    <ComplexPublication
      complex={complex}
      access={access}
      viewerId={viewer.id}
      base={`${ADMIN_ROUTES.complexes}/${complex.id}`}
      readiness={readiness}
      completeness={completeness}
      state="draft"
      files={files.map((file) => ({ id: file.id, kind: file.kind, src: mediaSrc(file.path) }))}
      requests={requests}
      journal={journal}
      finishings={finishingNames(finishings)}
      developer={developerOf(complex)}
      siteHref={`${siteOrigin()}/ru${complexRoute(complex.slug)}`}
      actions={{
        setStatus: setComplexStatusAction,
        requests: access.publish ? HEAD_ACTIONS : MANAGER_ACTIONS,
        preview: previewLinkAction,
        loadJournal: loadJournalAction,
      }}
    />
  );
}
