import { ComplexPhotos } from "@/components/ComplexPhotos";
import {
  attachComplexPhotoAction,
  removeComplexPhotoAction,
  reorderComplexPhotosAction,
  setComplexPhotoFocusAction,
} from "@/lib/admin/actions/complexMedia";
import type { PhotoActions } from "@/lib/admin/complexes/photos";
import { complexForTab } from "@/lib/admin/server/complexPage";
import { readComplexPhotos } from "@/lib/admin/server/complexTabs";
import { mediaSrc } from "@/lib/admin/server/developerPage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

const PHOTO_ACTIONS: PhotoActions = {
  attach: attachComplexPhotoAction,
  reorder: reorderComplexPhotosAction,
  remove: removeComplexPhotoAction,
  setFocus: setComplexPhotoFocusAction,
};

/** Вкладка «Фото» (И6): галерея, первое — обложка; сохраняется сразу. */
export default async function ComplexPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const complex = await complexForTab(params, "photos");
  if (!complex) return null;
  const photos = await readComplexPhotos(await createSupabaseServerClient(), complex.id, mediaSrc);
  return (
    <ComplexPhotos
      key={complex.id}
      complexId={complex.id}
      published={complex.status === "published"}
      photos={photos}
      actions={PHOTO_ACTIONS}
    />
  );
}
