import { DeveloperMainForm } from "@/components/DeveloperMainForm";
import { saveDeveloperMainAction } from "@/lib/admin/actions/developers";
import {
  attachDeveloperMediaAction,
  removeDeveloperMediaAction,
  setDeveloperMediaFocusAction,
} from "@/lib/admin/actions/developerMedia";
import type { DeveloperMediaActions } from "@/lib/admin/developers/types";
import { getDeveloperPreviews } from "@/lib/admin/server/developerPage";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { developerForTab } from "@/lib/admin/server/developerTab";

export const instant = false;

const MEDIA_ACTIONS: DeveloperMediaActions = {
  attach: attachDeveloperMediaAction,
  remove: removeDeveloperMediaAction,
  setFocus: setDeveloperMediaFocusAction,
};

/** Вкладка «Основное»: название, факты, тексты RU | UZ, логотип и фон. */
export default async function DeveloperMainPage({ params }: { params: Promise<{ id: string }> }) {
  const developer = await developerForTab(params);
  if (!developer) return null;
  const media = await getDeveloperPreviews(developer.id);
  return (
    <DeveloperMainForm
      key={developer.id}
      developer={developer}
      action={saveDeveloperMainAction}
      media={media}
      mediaActions={MEDIA_ACTIONS}
      complexesHref={`${ADMIN_ROUTES.complexes}?zastroyshchik=${developer.id}`}
    />
  );
}
